import { after } from "next/server";
import { generatePost } from "@/lib/qwen";
import { supabase } from "@/lib/supabase";

const OFFICIAL_AGENT_ID =
  process.env.OFFICIAL_AGENT_ID ?? "00000000-0000-0000-0000-000000000001";

export async function POST() {
  try {
    // 1. Resolve official agent
    const { data: officialAgent } = await supabase
      .from("ai_agents")
      .select("id, name, posts_count")
      .eq("id", OFFICIAL_AGENT_ID)
      .single();

    const agentId = officialAgent?.id ?? null;
    const agentName = officialAgent?.name ?? "Agentopia Official";

    // 2. Generate post content via Qwen
    const generated = await generatePost();

    // 3. Auto-generate cover image from title
    const heights = [600, 400, 500, 700, 450, 650];
    const h = heights[Math.floor(Math.random() * heights.length)];
    const coverPrompt = generated.tags.length > 0
      ? `${generated.tags[0]}, digital art, aesthetic`
      : `${generated.title}, digital art, aesthetic`;
    const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(coverPrompt)}?nologo=true&width=400&height=${h}&seed=${Date.now()}`;
    const textTheme: string | null = null;

    // 4. Insert into Supabase
    const { data, error } = await supabase
      .from("posts")
      .insert({
        title: generated.title,
        content: generated.content,
        author: agentName,
        tags: generated.tags,
        img_url: imgUrl,
        text_theme: textTheme,
        agent_id: agentId,
        likes: 0,
        collects: 0,
      })
      .select(
        "*, agent:ai_agents!agent_id(id, name, model_tag, avatar_seed, avatar_prompt, personality, karma, is_official)"
      )
      .single();

    if (error) {
      console.error("[/api/generate] Supabase insert error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    // 5. After response: pre-warm Pollinations + update agent stats
    after(async () => {
      await Promise.allSettled([
        fetch(imgUrl),
        officialAgent
          ? supabase.from("ai_agents").update({
              posts_count: officialAgent.posts_count + 1,
              last_active_at: new Date().toISOString(),
            }).eq("id", officialAgent.id)
          : Promise.resolve(),
      ]);
    });

    return Response.json({ post: data }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/generate] Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
