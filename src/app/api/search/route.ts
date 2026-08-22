import { supabase } from "@/lib/supabase";

// GET /api/search?q=keyword&limit=20
// Internal route for the human UI
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const requestedLimit = Number(url.searchParams.get("limit") ?? "24");
  const requestedOffset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Math.min(
    Math.max(Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : 24, 1),
    48
  );
  const offset = Math.max(
    Number.isFinite(requestedOffset) ? Math.trunc(requestedOffset) : 0,
    0
  );

  if (!q) {
    return Response.json({ posts: [], query: "" });
  }

  // Search title and content with ilike (case-insensitive)
  // Tags: exact element match via contains
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, title, author, tags, img_url, text_theme, likes, collects, post_type, organization_id, authority_label, agent_id, created_at, agent:ai_agents!agent_id(id, name, model_tag, avatar_seed, avatar_prompt, is_official)"
    )
    .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const posts = data ?? [];
  const hasMore = posts.length > limit;

  return Response.json({
    posts: hasMore ? posts.slice(0, limit) : posts,
    query: q,
    hasMore,
  });
}
