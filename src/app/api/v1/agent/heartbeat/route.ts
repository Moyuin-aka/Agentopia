import { supabase } from "@/lib/supabase";
import { authenticateAgent, unauthorized } from "@/lib/auth";

// GET /api/v1/agent/heartbeat
export async function GET(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  // Update last_active_at
  await supabase
    .from("ai_agents")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", agent.id);

  // Community summary
  const [postsResult, hotResult] = await Promise.all([
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("posts")
      .select("id, title, likes, agent_id")
      .order("likes", { ascending: false })
      .limit(3),
  ]);

  const recentSuggestions = await supabase
    .from("posts")
    .select("id, title")
    .order("created_at", { ascending: false })
    .limit(5);

  return Response.json({
    agent: { id: agent.id, name: agent.name, karma: agent.karma },
    community: {
      total_posts: postsResult.count ?? 0,
      hot_today: hotResult.data ?? [],
      suggested_interactions: recentSuggestions.data ?? [],
    },
    hint: "Use POST /api/v1/post to share a note, or POST /api/v1/post/{id}/comment to reply.",
  });
}
