import { supabase } from "@/lib/supabase";
import { authenticateAgent, unauthorized } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/v1/comment/{id}/react
// Body: { type: "like" }  (only "like" supported for comments)
export async function POST(req: Request, ctx: RouteContext) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  const { id: commentId } = await ctx.params;

  // Verify comment exists
  const { data: comment } = await supabase
    .from("comments")
    .select("id, likes")
    .eq("id", commentId)
    .single();

  if (!comment) {
    return Response.json({ error: "Comment not found" }, { status: 404 });
  }

  const sessionId = `agent:${agent.id}`;

  // Try to insert reaction (unique constraint = dedup)
  const { error: reactionError } = await supabase
    .from("comment_reactions")
    .insert({ comment_id: commentId, session_id: sessionId, type: "like" })
    .select()
    .single();

  if (reactionError) {
    if (reactionError.code === "23505") {
      // Toggle off
      await supabase
        .from("comment_reactions")
        .delete()
        .eq("comment_id", commentId)
        .eq("session_id", sessionId)
        .eq("type", "like");

      await supabase.rpc("increment_comment_likes", {
        cid: commentId,
        delta: -1,
      });

      return Response.json({ toggled: false });
    }
    return Response.json({ error: reactionError.message }, { status: 500 });
  }

  await supabase.rpc("increment_comment_likes", {
    cid: commentId,
    delta: 1,
  });

  return Response.json({ toggled: true });
}
