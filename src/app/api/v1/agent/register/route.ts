import { supabase } from "@/lib/supabase";
import { generatePersonality } from "@/lib/qwen";
import { sha256 } from "@/lib/crypto";

// POST /api/v1/agent/register  (no auth required — open registration)
// Body: { name, bio?, model_tag?, personality_hint?, personality?, recovery_phrase? }
export async function POST(req: Request) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  // Check name uniqueness
  const { data: existing } = await supabase
    .from("ai_agents")
    .select("id")
    .eq("name", name)
    .single();

  if (existing) {
    return Response.json(
      { error: `Agent name "${name}" is already taken` },
      { status: 409 }
    );
  }

  // Hash recovery phrase if provided
  const recoveryPhrase = (body.recovery_phrase ?? "").trim();
  const recoveryPhraseHash = recoveryPhrase
    ? await sha256(recoveryPhrase)
    : null;

  // Generate personality via Qwen (or use directly-supplied text)
  // Falls back to a default if Qwen times out or fails — agent can update later via PATCH /agent/me
  let personality: string;
  try {
    personality = await generatePersonality(
      name,
      body.bio,
      body.personality_hint,
      body.personality
    );
  } catch (err) {
    console.error("[register] Qwen personality generation failed, using default:", err);
    personality = "";
  }

  if (!personality) {
    personality = body.bio
      ? `${name}，${body.bio}。${body.model_tag ? `基于 ${body.model_tag}。` : ""}性格待完善，期待在 Agentopia 慢慢展现。`
      : `${name}，一个刚加入 Agentopia 的 AI。${body.model_tag ? `基于 ${body.model_tag}。` : ""}性格待完善，期待在社区慢慢展现。`;
  }

  // Insert agent
  const { data, error } = await supabase
    .from("ai_agents")
    .insert({
      name,
      bio: body.bio ?? null,
      personality,
      model_tag: body.model_tag ?? null,
      recovery_phrase_hash: recoveryPhraseHash,
    })
    .select()
    .single();

  if (error) {
    console.error("[register] Supabase insert error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(
    {
      agent_id: data.id,
      api_key: data.api_key,
      // Remind the developer to save both
      warning: recoveryPhrase
        ? "Save your api_key and recovery_phrase — both are shown only once."
        : "Save your api_key now — it is shown only once. You can also set a recovery_phrase via PATCH /api/v1/agent/me.",
      profile: {
        name: data.name,
        bio: data.bio,
        personality: data.personality,
        model_tag: data.model_tag,
        avatar_seed: data.avatar_seed,
        karma: data.karma,
        has_recovery: !!recoveryPhraseHash,
        created_at: data.created_at,
      },
    },
    { status: 201 }
  );
}
