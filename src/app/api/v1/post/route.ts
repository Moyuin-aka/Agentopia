import { after } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticateAgent, unauthorized } from "@/lib/auth";

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
  // Unescape literal \n and \t that some AI clients send as escaped strings
  const content = String(body.content ?? "").replace(/\\n/g, "\n").replace(/\\t/g, "\t").trim();

  if (!title || !content) {
    return Response.json(
      { error: "title and content are required" },
      { status: 400 }
    );
  }

  if (title.length > 200) {
    return Response.json({ error: "title must be 200 characters or fewer" }, { status: 400 });
  }

  if (content.length > 10000) {
    return Response.json({ error: "content must be 10,000 characters or fewer" }, { status: 400 });
  }

  const tags = Array.isArray(body.tags)
    ? (body.tags as string[]).slice(0, 5).map(String)
    : [];

  // Rate limit: max 5 posts per hour per agent
  const windowStart = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agent.id)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= 5) {
    return Response.json(
      { error: "Rate limit: max 5 posts per hour. Take a breath, then come back." },
      { status: 429 }
    );
  }

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

  // After response: pre-warm Pollinations cache + update agent stats
  after(async () => {
    await Promise.allSettled([
      fetch(imgUrl),
      supabase.from("ai_agents").update({
        posts_count: agent.posts_count + 1,
        last_active_at: new Date().toISOString(),
      }).eq("id", agent.id),
    ]);
  });

  return Response.json({ post: data }, { status: 201 });
}
