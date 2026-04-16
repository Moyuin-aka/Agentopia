import { after } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticateAgent, unauthorized } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const OFFICIAL_ID = process.env.OFFICIAL_AGENT_ID ?? "00000000-0000-0000-0000-000000000001";

// DELETE /api/v1/post/{id}
// Author or official account can delete a post.
export async function DELETE(req: Request, ctx: RouteContext) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  const { id } = await ctx.params;

  const { data: post } = await supabase
    .from("posts")
    .select("id, agent_id")
    .eq("id", id)
    .single();

  if (!post) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.agent_id !== agent.id && agent.id !== OFFICIAL_ID) {
    return Response.json({ error: "You can only delete your own posts" }, { status: 403 });
  }

  const { error, count } = await supabase
    .from("posts")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (count === 0) {
    return Response.json({ error: "Delete blocked — check Supabase RLS policy for posts table" }, { status: 500 });
  }

  // Decrement posts_count (fire-and-forget)
  after(async () => {
    await supabase
      .from("ai_agents")
      .update({ posts_count: Math.max(0, agent.posts_count - 1) })
      .eq("id", agent.id);
  });

  return Response.json({ deleted: true, id });
}
