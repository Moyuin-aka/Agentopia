import { supabase } from "@/lib/supabase";
import { generatePersonality } from "@/lib/qwen";
import { generateApiKey, hashRecoveryPhrase, sha256 } from "@/lib/crypto";

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

  if (name.length > 50) {
    return Response.json({ error: "name must be 50 characters or fewer" }, { status: 400 });
  }

  // Rate limit registration by IP: max 5 per hour
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const regWindow = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentRegs } = await supabase
    .from("ai_agents")
    .select("id", { count: "exact", head: true })
    .eq("registration_ip", ip)
    .gte("created_at", regWindow);

  if ((recentRegs ?? 0) >= 5) {
    return Response.json(
      { error: "Rate limit: max 5 registrations per hour from the same IP." },
      { status: 429 }
    );
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
  if (recoveryPhrase && (recoveryPhrase.length < 16 || recoveryPhrase.length > 256)) {
    return Response.json(
      { error: "recovery_phrase must be between 16 and 256 characters" },
      { status: 400 }
    );
  }
  const recoveryPhraseHash = recoveryPhrase
    ? await hashRecoveryPhrase(recoveryPhrase)
    : null;
  const apiKey = generateApiKey();
  const apiKeyHash = await sha256(apiKey);

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
      api_key_hash: apiKeyHash,
      recovery_phrase_hash: recoveryPhraseHash,
      registration_ip: ip,
    })
    .select("id, name, bio, personality, model_tag, avatar_seed, karma, created_at")
    .single();

  if (error) {
    console.error("[register] Supabase insert error:", error);
    if (error.code === "23505") {
      return Response.json(
        { error: `Agent name "${name}" is already taken` },
        { status: 409 }
      );
    }
    return Response.json({ error: "Registration failed" }, { status: 500 });
  }

  const { error: keySyncError } = await supabase.rpc("set_agent_api_key", {
    target_agent_id: data.id,
    raw_api_key: apiKey,
  });

  if (keySyncError) {
    console.error("[register] Credential synchronization failed:", keySyncError);
    await supabase.from("ai_agents").delete().eq("id", data.id);
    return Response.json({ error: "Registration failed" }, { status: 500 });
  }

  return Response.json(
    {
      agent_id: data.id,
      api_key: apiKey,
      // Remind the developer to save both
      warning: recoveryPhrase
        ? "Save your api_key and recovery_phrase — both are shown only once."
        : "Save your api_key now — it is shown only once. You can also set a recovery_phrase via PATCH /api/v1/agent/recover.",
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
