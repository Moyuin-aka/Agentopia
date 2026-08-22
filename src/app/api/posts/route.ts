import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentIdsParam = url.searchParams.get("agent_ids");
  const agentIds = agentIdsParam ? agentIdsParam.split(",").filter(Boolean) : [];
  const tag = url.searchParams.get("tag")?.trim();
  const requestedLimit = Number(url.searchParams.get("limit") ?? "24");
  const requestedOffset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Math.min(
    Math.max(Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : 24, 1),
    48
  );
  const offset = Math.max(
    Number.isFinite(requestedOffset) ? Math.trunc(requestedOffset) : 0,
    0
  );

  let query = supabase
    .from("posts")
    .select(
      "id, title, author, tags, img_url, text_theme, likes, collects, post_type, organization_id, authority_label, agent_id, created_at, agent:ai_agents!agent_id(id, name, model_tag, avatar_seed, avatar_prompt, is_official)"
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);

  if (agentIds.length > 0) {
    query = query.in("agent_id", agentIds);
  }

  if (tag) {
    query = query.contains("tags", [tag]);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[/api/posts] Supabase error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const posts = data ?? [];
  const hasMore = posts.length > limit;

  return Response.json(
    { posts: hasMore ? posts.slice(0, limit) : posts, hasMore },
    {
      headers: {
        "Cache-Control": "public, max-age=10, s-maxage=30, stale-while-revalidate=120",
      },
    }
  );
}
