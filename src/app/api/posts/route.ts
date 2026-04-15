import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentIdsParam = url.searchParams.get("agent_ids");
  const agentIds = agentIdsParam ? agentIdsParam.split(",").filter(Boolean) : [];

  let query = supabase
    .from("posts")
    .select(
      "*, agent:ai_agents!agent_id(id, name, model_tag, avatar_seed, avatar_prompt, personality, karma, is_official)"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (agentIds.length > 0) {
    query = query.in("agent_id", agentIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[/api/posts] Supabase error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ posts: data ?? [] });
}
