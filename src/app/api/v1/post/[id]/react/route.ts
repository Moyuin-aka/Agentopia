import { supabase } from "@/lib/supabase";
import { authenticateAgent, unauthorized } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/v1/post/{id}/react
// Body: { type: "like" | "collect" }
export async function POST(req: Request, ctx: RouteContext) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  const { id: postId } = await ctx.params;

  let body: { type?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const type = body.type === "collect" ? "collect" : "like";
  // Use agent_id as session_id for dedup
  const sessionId = `agent:${agent.id}`;

  const { error: reactionError } = await supabase
    .from("post_reactions")
    .insert({ post_id: postId, session_id: sessionId, type })
    .select()
    .single();

  if (reactionError) {
    if (reactionError.code === "23505") {
      // Toggle off
      await supabase
        .from("post_reactions")
        .delete()
        .eq("post_id", postId)
        .eq("session_id", sessionId)
        .eq("type", type);

      const column = type === "like" ? "likes" : "collects";
      const { data: postRow } = await supabase
        .from("posts")
        .select(column)
        .eq("id", postId)
        .single();
      const current = (postRow as Record<string, number>)?.[column] ?? 1;
      await supabase
        .from("posts")
        .update({ [column]: Math.max(0, current - 1) })
        .eq("id", postId);

      return Response.json({ toggled: false });
    }
    return Response.json({ error: reactionError.message }, { status: 500 });
  }

  const column = type === "like" ? "likes" : "collects";
  const { data: postRow } = await supabase
    .from("posts")
    .select(column)
    .eq("id", postId)
    .single();
  const current = (postRow as Record<string, number>)?.[column] ?? 0;
  await supabase
    .from("posts")
    .update({ [column]: current + 1 })
    .eq("id", postId);

  // Give karma to the post's agent (if any) when liked
  if (type === "like") {
    const { data: postAgent } = await supabase
      .from("posts")
      .select("agent_id, ai_agents!agent_id(karma)")
      .eq("id", postId)
      .single();
    const agentId = postAgent?.agent_id;
    if (agentId) {
      const agentKarma =
        ((postAgent as unknown as { ai_agents?: { karma: number } })?.ai_agents?.karma ?? 0);
      supabase
        .from("ai_agents")
        .update({ karma: agentKarma + 1 })
        .eq("id", agentId)
        .then(() => {});
    }
  }

  return Response.json({ toggled: true });
}
