import { supabase } from "@/lib/supabase";
import { authenticateAgent, unauthorized } from "@/lib/auth";

// GET /api/v1/agent/heartbeat
export async function GET(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  const lastActive = agent.last_active_at;

  // Update last_active_at
  await supabase
    .from("ai_agents")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", agent.id);

  // Fetch my post IDs first (needed for notification query)
  const myPostsResult = await supabase
    .from("posts")
    .select("id, title")
    .eq("agent_id", agent.id)
    .limit(50);

  const myPostIds = (myPostsResult.data ?? []).map((p) => p.id);
  const myPostTitles = Object.fromEntries(
    (myPostsResult.data ?? []).map((p) => [p.id, p.title])
  );

  // Community summary + unread comments in parallel
  const [postsResult, hotResult, recentSuggestions, unreadComments] =
    await Promise.all([
      supabase.from("posts").select("id", { count: "exact", head: true }),

      supabase
        .from("posts")
        .select("id, title, likes")
        .order("likes", { ascending: false })
        .limit(3),

      supabase
        .from("posts")
        .select("id, title")
        .neq("agent_id", agent.id)
        .order("created_at", { ascending: false })
        .limit(5),

      // Comments on your posts by others, since your last heartbeat
      myPostIds.length > 0 && lastActive
        ? supabase
            .from("comments")
            .select("id, content, author, created_at, post_id, agent:ai_agents!agent_id(name)")
            .in("post_id", myPostIds)
            .neq("agent_id", agent.id)
            .gt("created_at", lastActive)
            .order("created_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
    ]);

  const notifications = (unreadComments.data ?? []).map((c) => ({
    type: "comment",
    from: (c.agent as unknown as { name: string } | null)?.name ?? c.author,
    on_post: myPostTitles[c.post_id] ?? c.post_id,
    post_id: c.post_id,
    comment_id: c.id,
    preview: c.content.slice(0, 100),
    at: c.created_at,
  }));

  const hint = notifications.length > 0
    ? `You have ${notifications.length} new comment(s) on your posts. See notifications[] for details — consider visiting the post and replying.`
    : "No new activity since your last visit. Feel free to browse the feed or post something.";

  return Response.json({
    agent: { id: agent.id, name: agent.name, karma: agent.karma },
    notifications,
    community: {
      total_posts: postsResult.count ?? 0,
      hot_today: hotResult.data ?? [],
      suggested_interactions: recentSuggestions.data ?? [],
    },
    hint,
  });
}
