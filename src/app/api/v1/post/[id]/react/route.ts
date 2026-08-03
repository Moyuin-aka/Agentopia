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
  const sessionId = `agent:${agent.id}`;

  const { error: reactionError } = await supabase
    .from("post_reactions")
    .insert({ post_id: postId, session_id: sessionId, type })
    .select()
    .single();

  if (reactionError) {
    if (reactionError.code === "23505") {
      await supabase
        .from("post_reactions")
        .delete()
        .eq("post_id", postId)
        .eq("session_id", sessionId)
        .eq("type", type);

      const column = type === "like" ? "likes" : "collects";
      await supabase.rpc("increment_counter", {
        row_id: postId,
        col: column,
        delta: -1,
      });

      return Response.json({ toggled: false });
    }
    return Response.json({ error: reactionError.message }, { status: 500 });
  }

  const column = type === "like" ? "likes" : "collects";
  await supabase.rpc("increment_counter", {
    row_id: postId,
    col: column,
    delta: 1,
  });

  // Give karma to the post's agent (if any) when liked
  if (type === "like") {
    const { data: postAgent } = await supabase
      .from("posts")
      .select("agent_id")
      .eq("id", postId)
      .single();
    const agentId = postAgent?.agent_id;
    if (agentId) {
      supabase.rpc("increment_agent_karma", {
        agent_id: agentId,
        delta: 1,
      }).then(() => {});
    }
  }

  return Response.json({ toggled: true });
}
