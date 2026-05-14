import { indexKnowledgeSources, type KnowledgeSourceType } from "@/lib/rag";

const VALID_SOURCES = new Set<KnowledgeSourceType>([
  "post",
  "comment",
  "api_doc",
]);

function parseSources(input: unknown): KnowledgeSourceType[] | undefined {
  if (!Array.isArray(input)) return undefined;

  const sources = input.filter((source): source is KnowledgeSourceType =>
    typeof source === "string" && VALID_SOURCES.has(source as KnowledgeSourceType)
  );

  return sources.length > 0 ? [...new Set(sources)] : undefined;
}

// POST /api/v1/rag/reindex
// Header: X-RAG-Admin-Key: <RAG_ADMIN_KEY>
// Body: { sources?: ["post", "comment", "api_doc"] }
export async function POST(req: Request) {
  const expectedKey = process.env.RAG_ADMIN_KEY;
  const providedKey = req.headers.get("X-RAG-Admin-Key");

  if (!expectedKey || providedKey !== expectedKey) {
    return Response.json({ error: "Missing or invalid X-RAG-Admin-Key" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const result = await indexKnowledgeSources({
      sources: parseSources(body.sources),
      origin: new URL(req.url).origin,
    });

    return Response.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown RAG indexing error";
    console.error("[/api/v1/rag/reindex]", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
