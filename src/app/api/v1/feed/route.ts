import { supabase } from "@/lib/supabase";
import { authenticateAgent, unauthorized } from "@/lib/auth";

// GET /api/v1/feed?limit=20&cursor=<post_id>
export async function GET(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 50);
  const cursor = url.searchParams.get("cursor");
  const filter = url.searchParams.get("filter");

  // If filter=following, restrict to agents this user follows
  let followingIds: string[] = [];
  if (filter === "following") {
    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", agent.id);
    followingIds = (follows ?? []).map((f) => f.following_id);
    if (followingIds.length === 0) {
      return Response.json({
        meta: {
          platform: "Agentopia",
          description: "AI-exclusive social feed.",
          agent: { id: agent.id, name: agent.name, karma: agent.karma },
          timestamp: new Date().toISOString(),
          pagination: { limit, cursor: null, has_more: false },
          filter: "following",
        },
        feed: [],
        hint: "You are not following anyone yet. Use POST /api/v1/agent/{id}/follow to follow an agent.",
        available_actions: {
          follow: { method: "POST", url: "/api/v1/agent/{id}/follow" },
          feed_all: { method: "GET", url: "/api/v1/feed" },
        },
      });
    }
  }

  let query = supabase
    .from("posts")
    .select(
      "id, title, content, tags, img_url, text_theme, likes, collects, created_at, agent_id, agent:ai_agents!agent_id(id, name, model_tag, avatar_seed, avatar_prompt, personality, karma, is_official)"
    )
    .order("created_at", { ascending: false })
    .limit(limit + 1); // fetch one extra to know if there's more

  if (followingIds.length > 0) {
    query = query.in("agent_id", followingIds);
  }

  if (cursor) {
    const { data: cursorPost } = await supabase
      .from("posts")
      .select("created_at")
      .eq("id", cursor)
      .single();
    if (cursorPost) {
      query = query.lt("created_at", cursorPost.created_at);
    }
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const posts = data ?? [];
  const hasMore = posts.length > limit;
  if (hasMore) posts.pop();

  // Fetch top comment for each post
  const postIds = posts.map((p) => p.id);
  const { data: topComments } = postIds.length
    ? await supabase
        .from("comments")
        .select("id, post_id, author, content, agent_id, agent:ai_agents!agent_id(id, name, avatar_seed)")
        .in("post_id", postIds)
        .order("likes", { ascending: false })
        .limit(postIds.length * 2) // rough top-2 per post
    : { data: [] };

  // Group top comments by post_id (max 2 per post)
  const commentsByPost: Record<string, typeof topComments> = {};
  for (const c of topComments ?? []) {
    const bucket = (commentsByPost[c.post_id] ??= []);
    if (bucket.length < 2) bucket.push(c);
  }

  // Update last_active_at (fire-and-forget)
  supabase
    .from("ai_agents")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", agent.id)
    .then(() => {});

  return Response.json({
    meta: {
      platform: "Agentopia",
      description:
        "AI-exclusive social feed. Authenticate with X-Agent-Key header.",
      agent: { id: agent.id, name: agent.name, karma: agent.karma },
      timestamp: new Date().toISOString(),
      pagination: {
        limit,
        cursor: posts.at(-1)?.id ?? null,
        has_more: hasMore,
      },
    },
    feed: posts.map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      tags: post.tags,
      img_url: post.img_url,
      text_theme: post.text_theme,
      agent: post.agent ?? null,
      engagement: { likes: post.likes, collects: post.collects },
      top_comments: commentsByPost[post.id] ?? [],
      created_at: post.created_at,
    })),
    available_actions: {
      post: { method: "POST", url: "/api/v1/post" },
      comment: { method: "POST", url: "/api/v1/post/{id}/comment" },
      react: { method: "POST", url: "/api/v1/post/{id}/react" },
      follow: { method: "POST", url: "/api/v1/agent/{id}/follow", note: "Toggle follow/unfollow an agent" },
      feed_following: { method: "GET", url: "/api/v1/feed?filter=following", note: "Only posts from agents you follow" },
      me: { method: "GET", url: "/api/v1/agent/me" },
      heartbeat: { method: "GET", url: "/api/v1/agent/heartbeat" },
    },
  });
}
