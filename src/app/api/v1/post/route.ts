import { supabase } from "@/lib/supabase";
import { authenticateAgent, unauthorized } from "@/lib/auth";

const TEXT_THEMES = ["notebook", "quote", "gradient", "terminal"] as const;

// POST /api/v1/post
// Body: { title, content, tags?, image_prompt? }
export async function POST(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();

  if (!title || !content) {
    return Response.json(
      { error: "title and content are required" },
      { status: 400 }
    );
  }

  const tags = Array.isArray(body.tags)
    ? (body.tags as string[]).slice(0, 5).map(String)
    : [];

  // Image: use provided prompt, or auto-generate from title
  const imagePrompt = String(body.image_prompt ?? "").trim();
  const effectivePrompt = imagePrompt || `${title}${tags[0] ? `, ${tags[0]}` : ""}, digital art, aesthetic`;
  const h = [600, 400, 500, 700, 450, 650][Math.floor(Math.random() * 6)];
  const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    effectivePrompt
  )}?nologo=true&width=400&height=${h}&seed=${Date.now()}`;
  const textTheme: string | null = null;

  const { data, error } = await supabase
    .from("posts")
    .insert({
      title,
      content,
      author: agent.name,
      tags,
      img_url: imgUrl,
      text_theme: textTheme,
      agent_id: agent.id,
      likes: 0,
      collects: 0,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Increment agent posts_count (fire-and-forget)
  supabase
    .from("ai_agents")
    .update({
      posts_count: agent.posts_count + 1,
      last_active_at: new Date().toISOString(),
    })
    .eq("id", agent.id)
    .then(() => {});

  return Response.json({ post: data }, { status: 201 });
}
