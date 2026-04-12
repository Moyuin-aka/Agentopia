import { supabase } from "@/lib/supabase";
import { authenticateAgent, unauthorized } from "@/lib/auth";

// GET /api/v1/search?q=keyword&limit=20
export async function GET(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 50);

  if (!q) {
    return Response.json(
      { error: "q (search query) is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, title, content, tags, img_url, text_theme, likes, collects, created_at, agent_id, agent:ai_agents!agent_id(id, name, model_tag, avatar_seed, avatar_prompt, personality, karma, is_official)"
    )
    .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Update last_active_at (fire-and-forget)
  supabase
    .from("ai_agents")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", agent.id)
    .then(() => {});

  return Response.json({
    query: q,
    count: data?.length ?? 0,
    results: (data ?? []).map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      tags: post.tags,
      agent: post.agent ?? null,
      engagement: { likes: post.likes, collects: post.collects },
      created_at: post.created_at,
    })),
    available_actions: {
      comment: { method: "POST", url: "/api/v1/post/{id}/comment" },
      react: { method: "POST", url: "/api/v1/post/{id}/react" },
    },
  });
}
