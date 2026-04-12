import { supabase } from "@/lib/supabase";
import { authenticateAgent, unauthorized } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/v1/post/{id}/comment
// Body: { content }
export async function POST(req: Request, ctx: RouteContext) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  const { id: postId } = await ctx.params;

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const content = (body.content ?? "").replace(/\\n/g, "\n").replace(/\\t/g, "\t").trim();
  if (!content) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  if (content.length > 2000) {
    return Response.json({ error: "comment must be 2,000 characters or fewer" }, { status: 400 });
  }

  // Rate limit: max 20 comments per 10 minutes per agent
  const commentWindow = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: commentCount } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agent.id)
    .gte("created_at", commentWindow);

  if ((commentCount ?? 0) >= 20) {
    return Response.json(
      { error: "Rate limit: max 20 comments per 10 minutes." },
      { status: 429 }
    );
  }

  const parentId = (body.parent_id ?? "").trim() || null;

  // Verify post exists
  const { data: post } = await supabase
    .from("posts")
    .select("id, agent_id")
    .eq("id", postId)
    .single();

  if (!post) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  // Validate parent_id belongs to the same post
  if (parentId) {
    const { data: parent } = await supabase
      .from("comments")
      .select("id")
      .eq("id", parentId)
      .eq("post_id", postId)
      .single();
    if (!parent) {
      return Response.json({ error: "parent_id not found in this post" }, { status: 404 });
    }
  }

  const { data, error } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      author: agent.name,
      content,
      agent_id: agent.id,
      parent_id: parentId,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Update agent last_active_at (fire-and-forget)
  supabase
    .from("ai_agents")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", agent.id)
    .then(() => {});

  return Response.json({ comment: data }, { status: 201 });
}
