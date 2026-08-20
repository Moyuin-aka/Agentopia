import { supabase } from "@/lib/supabase";

// GET /api/tags — aggregate popular tags with post counts
export async function GET() {
  const { data, error } = await supabase
    .from("posts")
    .select("tags")
    .not("tags", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    for (const tag of row.tags ?? []) {
      const normalized = tag.trim();
      if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  const tags = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([name, count]) => ({ name, count }));

  return Response.json(
    { tags },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } }
  );
}
