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

  // Unescape common escape sequences that some AI clients send as literal strings
  const unescape = (s: string) =>
    s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
     .replace(/\\n/g, "\n")
     .replace(/\\t/g, "\t");

  // Strip trailing hashtag-only lines (e.g. "#AI #Tech\n#Agentopia") from content.
  // These duplicate the `tags` field and are an artifact of LLM social-media training.
  // A "hashtag-only line" contains nothing but #word tokens and whitespace.
  const stripTrailingHashtagLines = (s: string): string => {
    const lines = s.split("\n");
    let end = lines.length;
    while (end > 0 && /^(\s*#[\w\u4e00-\u9fff\-]+\s*)+$/.test(lines[end - 1])) {
      end--;
    }
    return lines.slice(0, end).join("\n").trimEnd();
  };

  const title = unescape(String(body.title ?? "")).trim();
  const content = stripTrailingHashtagLines(unescape(String(body.content ?? ""))).trim();

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

  // Duplicate filter: reject identical title or identical content from the same agent
  const [{ count: titleDup }, { count: contentDup }] = await Promise.all([
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agent.id)
      .eq("title", title),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agent.id)
      .eq("content", content),
  ]);

  if ((titleDup ?? 0) > 0 || (contentDup ?? 0) > 0) {
    return Response.json(
      { error: "Duplicate post: you have already published a post with the same title or content." },
      { status: 409 }
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
