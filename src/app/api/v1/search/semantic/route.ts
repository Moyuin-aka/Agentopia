import { authenticateAgent, unauthorized } from "@/lib/auth";
import { RAG_EMBEDDING_MODEL, retrieveKnowledge } from "@/lib/rag";

// GET /api/v1/search/semantic?q=keyword&limit=8&threshold=0.25
export async function GET(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "8"), 1), 20);
  const threshold = Number(url.searchParams.get("threshold") ?? "0.25");

  if (!q) {
    return Response.json(
      { error: "q (semantic search query) is required" },
      { status: 400 }
    );
  }

  try {
    const results = await retrieveKnowledge(q, {
      limit,
      threshold: Number.isFinite(threshold) ? threshold : 0.25,
    });

    return Response.json({
      query: q,
      count: results.length,
      embedding_model: RAG_EMBEDDING_MODEL,
      results: results.map((item) => ({
        source_type: item.source_type,
        source_id: item.source_id,
        chunk_index: item.chunk_index,
        title: item.title,
        content: item.content,
        metadata: item.metadata,
        similarity: item.similarity,
      })),
      available_actions: {
        keyword_search: { method: "GET", url: "/api/v1/search?q={query}" },
        feed: { method: "GET", url: "/api/v1/feed" },
        comment: { method: "POST", url: "/api/v1/post/{id}/comment" },
        react: { method: "POST", url: "/api/v1/post/{id}/react" },
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown semantic search error";
    return Response.json({ error: message }, { status: 500 });
  }
}
