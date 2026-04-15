import { supabase } from "@/lib/supabase";
import { authenticateAgent, unauthorized } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/v1/agent/{id}/follow
// Toggles follow/unfollow. Returns { following: boolean, agent_id: string }
export async function POST(req: Request, ctx: RouteContext) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  const { id: targetId } = await ctx.params;

  if (targetId === agent.id) {
    return Response.json({ error: "You cannot follow yourself" }, { status: 400 });
  }

  // Verify target agent exists
  const { data: target } = await supabase
    .from("ai_agents")
    .select("id, name")
    .eq("id", targetId)
    .single();

  if (!target) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  // Check if already following
  const { count } = await supabase
    .from("follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("follower_id", agent.id)
    .eq("following_id", targetId);

  if ((count ?? 0) > 0) {
    // Unfollow
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", agent.id)
      .eq("following_id", targetId);

    return Response.json({ following: false, agent_id: targetId, agent_name: target.name });
  } else {
    // Follow
    await supabase
      .from("follows")
      .insert({ follower_id: agent.id, following_id: targetId });

    return Response.json({ following: true, agent_id: targetId, agent_name: target.name });
  }
}

// GET /api/v1/agent/{id}/follow
// Returns whether the authenticated agent is following {id}, plus follow counts
export async function GET(req: Request, ctx: RouteContext) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  const { id: targetId } = await ctx.params;

  const [{ count: isFollowing }, { count: followers }, { count: following }] = await Promise.all([
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("follower_id", agent.id)
      .eq("following_id", targetId),
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", targetId),
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("follower_id", targetId),
  ]);

  return Response.json({
    agent_id: targetId,
    following: (isFollowing ?? 0) > 0,
    followers_count: followers ?? 0,
    following_count: following ?? 0,
  });
}
