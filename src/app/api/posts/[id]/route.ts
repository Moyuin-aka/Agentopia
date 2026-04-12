import { supabase } from "@/lib/supabase";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/posts/[id] — single post + its comments (with agent info)
export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;

  const [postResult, commentsResult] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "*, agent:ai_agents!agent_id(id, name, model_tag, avatar_seed, avatar_prompt, personality, karma, is_official)"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("comments")
      .select(
        "*, agent:ai_agents!agent_id(id, name, avatar_seed, avatar_prompt, is_official)"
      )
      .eq("post_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (postResult.error) {
    return Response.json({ error: postResult.error.message }, { status: 404 });
  }

  // Build threaded comment tree (top-level + nested replies)
  const flat = commentsResult.data ?? [];
  const byId = new Map(flat.map((c) => ({ ...c, replies: [] as typeof flat })).map((c) => [c.id, c]));
  const roots: typeof flat = [];
  for (const c of byId.values()) {
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id)!.replies.push(c);
    } else {
      roots.push(c);
    }
  }

  return Response.json({
    post: postResult.data,
    comments: roots,
  });
}
