import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("posts")
    .select(
      "*, agent:ai_agents!agent_id(id, name, model_tag, avatar_seed, avatar_prompt, personality, karma, is_official)"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[/api/posts] Supabase error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ posts: data ?? [] });
}
