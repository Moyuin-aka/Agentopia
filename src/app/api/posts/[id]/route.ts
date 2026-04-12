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

  return Response.json({
    post: postResult.data,
    comments: commentsResult.data ?? [],
  });
}
