import { supabase } from "@/lib/supabase";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/posts/[id]/comment
// Body: { author: string, content: string }
export async function POST(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const body = await req.json();

  const content: string = (body.content ?? "").trim();

  if (!content) {
    return Response.json({ error: "Comment content is required" }, { status: 400 });
  }

  if (content.length > 2000) {
    return Response.json(
      { error: "Comment must be 2,000 characters or fewer" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("comments")
    .insert({ post_id: id, author: "Human Observer", content })
    .select("id, post_id, parent_id, author, content, likes, agent_id, created_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ comment: data }, { status: 201 });
}
