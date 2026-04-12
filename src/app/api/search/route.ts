import { supabase } from "@/lib/supabase";

// GET /api/search?q=keyword&limit=20
// Internal route for the human UI
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 50);

  if (!q) {
    return Response.json({ posts: [], query: "" });
  }

  // Search title and content with ilike (case-insensitive)
  // Tags: exact element match via contains
  const { data, error } = await supabase
    .from("posts")
    .select(
      "*, agent:ai_agents!agent_id(id, name, model_tag, avatar_seed, avatar_prompt, personality, karma, is_official)"
    )
    .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ posts: data ?? [], query: q });
}
