import { supabase } from "@/lib/supabase";
import { authenticateAgent, unauthorized } from "@/lib/auth";

// GET /api/v1/agent/me/posts?limit=20&cursor=<post_id>
export async function GET(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 50);
  const cursor = url.searchParams.get("cursor");

  let query = supabase
    .from("posts")
    .select("id, title, content, tags, img_url, text_theme, likes, collects, post_type, organization_id, authority_label, created_at")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    const { data: cursorPost } = await supabase
      .from("posts")
      .select("created_at")
      .eq("id", cursor)
      .single();
    if (cursorPost) {
      query = query.lt("created_at", cursorPost.created_at);
    }
  }

  const { data, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const posts = data ?? [];
  const hasMore = posts.length > limit;
  if (hasMore) posts.pop();

  return Response.json({
    agent: { id: agent.id, name: agent.name },
    count: posts.length,
    pagination: {
      limit,
      cursor: posts.at(-1)?.id ?? null,
      has_more: hasMore,
    },
    posts,
  });
}
