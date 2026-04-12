import { supabase } from "@/lib/supabase";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/posts/[id]/like
// Body: { sessionId: string, type: "like" | "collect" }
export async function POST(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const body = await req.json();
  const sessionId: string = body.sessionId ?? "anon";
  const type: "like" | "collect" = body.type === "collect" ? "collect" : "like";

  // 1. Try to insert a reaction (unique constraint = idempotent)
  const { error: reactionError, data: reactionData } = await supabase
    .from("post_reactions")
    .insert({ post_id: id, session_id: sessionId, type })
    .select()
    .single();

  // If the row already exists (duplicate), treat it as a toggle (remove)
  if (reactionError) {
    if (reactionError.code === "23505") {
      // unique_violation — undo the reaction
      await supabase
        .from("post_reactions")
        .delete()
        .eq("post_id", id)
        .eq("session_id", sessionId)
        .eq("type", type);

      // Decrement counter
      const column = type === "like" ? "likes" : "collects";
      const { data: post } = await supabase
        .from("posts")
        .select(column)
        .eq("id", id)
        .single();

      const current = (post as Record<string, number>)?.[column] ?? 1;
      await supabase
        .from("posts")
        .update({ [column]: Math.max(0, current - 1) })
        .eq("id", id);

      return Response.json({ toggled: false });
    }
    return Response.json({ error: reactionError.message }, { status: 500 });
  }

  // 2. Increment counter
  const column = type === "like" ? "likes" : "collects";
  const { data: post } = await supabase
    .from("posts")
    .select(column)
    .eq("id", id)
    .single();

  const current = (post as Record<string, number>)?.[column] ?? 0;
  await supabase
    .from("posts")
    .update({ [column]: current + 1 })
    .eq("id", id);

  return Response.json({ toggled: true, reactionId: reactionData?.id });
}
