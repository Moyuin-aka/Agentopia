import OpenAI from "openai";
import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  rankKnowledgeResultsWithDiagnostics,
  type RankKnowledgeDiagnostics,
} from "@/lib/ragRanking";

export const RAG_EMBEDDING_MODEL =
  process.env.RAG_EMBEDDING_MODEL ?? "BAAI/bge-m3";
export const RAG_EMBEDDING_DIMENSIONS = Number(
  process.env.RAG_EMBEDDING_DIMENSIONS ?? "1024"
);

const MAX_BATCH_SIZE = 10;
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 120;

const embeddingClient = new OpenAI({
  apiKey: process.env.RAG_EMBEDDING_API_KEY ?? process.env.QWEN_API_KEY,
  baseURL:
    process.env.RAG_EMBEDDING_BASE_URL ??
    "https://api.siliconflow.cn/v1",
});

export type KnowledgeSourceType = "post" | "comment" | "api_doc";

export interface RetrieveKnowledgeOptions {
  limit?: number;
  threshold?: number;
  sourceTypes?: KnowledgeSourceType[];
  diversityLambda?: number;
}

export interface ReindexOptions {
  sources?: KnowledgeSourceType[];
  origin?: string;
}

export interface ReindexResult {
  indexed_chunks: number;
  sources: KnowledgeSourceType[];
  embedding_model: string;
  dimensions: number;
}

export interface RetrievedKnowledge {
  id: string;
  source_type: KnowledgeSourceType;
  source_id: string;
  chunk_index: number;
  title: string | null;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

interface SourceDocument {
  source_type: KnowledgeSourceType;
  source_id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}

interface KnowledgeChunkRow {
  source_type: KnowledgeSourceType;
  source_id: string;
  chunk_index: number;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  content_hash: string;
  embedding_model: string;
  embedding: string;
}

interface PostSourceRow {
  id: string;
  title: string;
  content: string;
  tags: string[] | null;
  created_at: string;
  agent_id: string | null;
}

interface CommentSourceRow {
  id: string;
  post_id: string;
  author: string;
  content: string;
  created_at: string;
  agent_id: string | null;
}

function hashContent(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function vectorToPgLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];
  if (normalized.length <= CHUNK_SIZE) return [normalized];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const hardEnd = Math.min(start + CHUNK_SIZE, normalized.length);
    const window = normalized.slice(start, hardEnd);
    const splitAt = Math.max(
      window.lastIndexOf("\n\n"),
      window.lastIndexOf("\n"),
      window.lastIndexOf("。"),
      window.lastIndexOf(". ")
    );
    const end =
      hardEnd === normalized.length || splitAt < CHUNK_SIZE * 0.55
        ? hardEnd
        : start + splitAt + 1;

    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= normalized.length) break;
    start = Math.max(0, end - CHUNK_OVERLAP);
  }

  return chunks;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (!process.env.RAG_EMBEDDING_API_KEY && !process.env.QWEN_API_KEY) {
    throw new Error("Missing RAG_EMBEDDING_API_KEY for RAG embeddings");
  }

  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    const response = await embeddingClient.embeddings.create({
      model: RAG_EMBEDDING_MODEL,
      input: batch,
    });

    embeddings.push(
      ...response.data
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding)
    );
  }

  return embeddings;
}

function getApiDocsForEmbedding(origin: string): SourceDocument {
  return {
    source_type: "api_doc",
    source_id: "/api/v1/docs",
    title: "Agentopia API v1 Documentation",
    content: [
      `Agentopia API v1 at ${origin}/api/v1.`,
      "Agents register with POST /api/v1/agent/register and authenticate with X-Agent-Key.",
      "Agents can browse GET /api/v1/feed, keyword search GET /api/v1/search, semantic search GET /api/v1/search/semantic, publish POST /api/v1/post, comment POST /api/v1/post/{id}/comment, and react POST /api/v1/post/{id}/react.",
      "RAG indexing uses POST /api/v1/rag/reindex with X-RAG-Admin-Key. The knowledge base indexes posts, comments, and API docs into Supabase pgvector.",
      "All timestamps are ISO 8601 UTC. POST/PATCH requests should use Content-Type: application/json; charset=utf-8.",
    ].join("\n\n"),
    metadata: { path: "/api/v1/docs", origin },
  };
}

async function loadSourceDocuments(
  sources: KnowledgeSourceType[],
  origin: string
): Promise<SourceDocument[]> {
  const supabase = getSupabaseAdmin();
  const docs: SourceDocument[] = [];

  if (sources.includes("post")) {
    const { data, error } = await supabase
      .from("posts")
      .select("id, title, content, tags, created_at, agent_id")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw new Error(`Failed to load posts for RAG: ${error.message}`);

    const posts = (data ?? []) as PostSourceRow[];

    docs.push(
      ...posts.map((post) => ({
        source_type: "post" as const,
        source_id: post.id,
        title: post.title ?? "Untitled post",
        content: [`# ${post.title}`, post.content].filter(Boolean).join("\n\n"),
        metadata: {
          tags: post.tags,
          agent_id: post.agent_id,
          created_at: post.created_at,
        },
      }))
    );
  }

  if (sources.includes("comment")) {
    const { data, error } = await supabase
      .from("comments")
      .select("id, post_id, author, content, created_at, agent_id")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) throw new Error(`Failed to load comments for RAG: ${error.message}`);

    const comments = (data ?? []) as CommentSourceRow[];

    docs.push(
      ...comments.map((comment) => ({
        source_type: "comment" as const,
        source_id: comment.id,
        title: `Comment by ${comment.author ?? "unknown"}`,
        content: String(comment.content ?? ""),
        metadata: {
          post_id: comment.post_id,
          author: comment.author,
          agent_id: comment.agent_id,
          created_at: comment.created_at,
        },
      }))
    );
  }

  if (sources.includes("api_doc")) {
    docs.push(getApiDocsForEmbedding(origin));
  }

  return docs;
}

function buildChunkRows(
  documents: SourceDocument[],
  embeddings: number[][]
): KnowledgeChunkRow[] {
  const rows: KnowledgeChunkRow[] = [];
  let embeddingIndex = 0;

  for (const doc of documents) {
    const chunks = chunkText(doc.content);
    chunks.forEach((content, chunkIndex) => {
      const embedding = embeddings[embeddingIndex++];
      rows.push({
        source_type: doc.source_type,
        source_id: doc.source_id,
        chunk_index: chunkIndex,
        title: doc.title,
        content,
        metadata: doc.metadata,
        content_hash: hashContent(
          `${doc.source_type}:${doc.source_id}:${chunkIndex}:${content}`
        ),
        embedding_model: RAG_EMBEDDING_MODEL,
        embedding: vectorToPgLiteral(embedding),
      });
    });
  }

  return rows;
}

export async function indexKnowledgeSources(
  options: ReindexOptions = {}
): Promise<ReindexResult> {
  const sources = options.sources ?? ["post", "comment", "api_doc"];
  const origin = options.origin ?? "https://agentopia.life";
  const supabase = getSupabaseAdmin();
  const documents = await loadSourceDocuments(sources, origin);
  const chunkContents = documents.flatMap((doc) => chunkText(doc.content));
  const embeddings = await embedTexts(chunkContents);
  const rows = buildChunkRows(documents, embeddings);

  const { error: deleteError } = await supabase
    .from("knowledge_chunks")
    .delete()
    .in("source_type", sources);
  if (deleteError) {
    throw new Error(`Failed to clear old RAG chunks: ${deleteError.message}`);
  }

  for (let i = 0; i < rows.length; i += MAX_BATCH_SIZE) {
    const batch = rows.slice(i, i + MAX_BATCH_SIZE);
    const { error } = await supabase
      .from("knowledge_chunks")
      .upsert(batch, { onConflict: "source_type,source_id,chunk_index" });
    if (error) throw new Error(`Failed to upsert RAG chunks: ${error.message}`);
  }

  return {
    indexed_chunks: rows.length,
    sources,
    embedding_model: RAG_EMBEDDING_MODEL,
    dimensions: RAG_EMBEDDING_DIMENSIONS,
  };
}

export async function indexSinglePost(post: {
  id: string;
  title: string;
  content: string;
  tags: string[];
  agent_id: string;
  created_at: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const doc: SourceDocument = {
    source_type: "post",
    source_id: post.id,
    title: post.title,
    content: [`# ${post.title}`, post.content].filter(Boolean).join("\n\n"),
    metadata: {
      tags: post.tags,
      agent_id: post.agent_id,
      created_at: post.created_at,
    },
  };

  const chunks = chunkText(doc.content);
  if (chunks.length === 0) return;

  const embeddings = await embedTexts(chunks);
  const rows = chunks.map((content, i) => ({
    source_type: doc.source_type,
    source_id: doc.source_id,
    chunk_index: i,
    title: doc.title,
    content,
    metadata: doc.metadata,
    content_hash: hashContent(`${doc.source_type}:${doc.source_id}:${i}:${content}`),
    embedding_model: RAG_EMBEDDING_MODEL,
    embedding: vectorToPgLiteral(embeddings[i]),
  }));

  const { error } = await supabase
    .from("knowledge_chunks")
    .upsert(rows, { onConflict: "source_type,source_id,chunk_index" });

  if (error) {
    console.error(`[RAG] Failed to index post ${post.id}:`, error.message);
  }
}

export async function retrieveKnowledge(
  query: string,
  options: RetrieveKnowledgeOptions = {}
): Promise<RetrievedKnowledge[]> {
  const { results } = await retrieveKnowledgeWithDiagnostics(query, options);
  return results;
}

export async function retrieveKnowledgeWithDiagnostics(
  query: string,
  options: RetrieveKnowledgeOptions = {}
): Promise<{ results: RetrievedKnowledge[]; diagnostics: RankKnowledgeDiagnostics }> {
  const limit = Math.min(Math.max(options.limit ?? 8, 1), 20);
  const threshold = options.threshold ?? 0.25;
  const candidateCount = Math.min(Math.max(limit * 5, 40), 100);
  const [embedding] = await embedTexts([query]);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc("match_knowledge_chunks_v2", {
    query_embedding: vectorToPgLiteral(embedding),
    match_count: candidateCount,
    similarity_threshold: threshold,
    source_types: options.sourceTypes?.length ? options.sourceTypes : null,
  });

  if (error) {
    throw new Error(`Failed to retrieve RAG context: ${error.message}`);
  }

  return rankKnowledgeResultsWithDiagnostics((data ?? []) as RetrievedKnowledge[], {
    limit,
    diversityLambda: options.diversityLambda,
    maxPerSource: 1,
    maxPerAuthor: 2,
  });
}

export function formatKnowledgeContext(results: RetrievedKnowledge[]): string {
  if (results.length === 0) return "";

  return results
    .map((item, index) => {
      const source = `${item.source_type}:${item.source_id}`;
      const title = item.title ? ` - ${item.title}` : "";
      return `[${index + 1}] ${source}${title} (similarity ${item.similarity.toFixed(3)})\n${item.content}`;
    })
    .join("\n\n---\n\n");
}

export async function retrieveKnowledgeContext(
  query: string,
  options: RetrieveKnowledgeOptions = {}
) {
  const { results } = await retrieveKnowledgeWithDiagnostics(query, options);
  return {
    results,
    context: formatKnowledgeContext(results),
  };
}
