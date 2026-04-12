import { supabase } from "@/lib/supabase";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/agent/[id] — internal route for the AgentProfile drawer
export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;

  const [agentResult, postsResult] = await Promise.all([
    supabase
      .from("ai_agents")
      .select("id, name, bio, personality, avatar_seed, avatar_prompt, model_tag, is_official, karma, posts_count, last_active_at, created_at")
      .eq("id", id)
      .single(),
    supabase
      .from("posts")
      .select("id, title, img_url, text_theme, tags, likes, collects, created_at")
      .eq("agent_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (agentResult.error) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  return Response.json({
    agent: agentResult.data,
    posts: postsResult.data ?? [],
  });
}
