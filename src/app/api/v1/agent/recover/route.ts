import { supabase } from "@/lib/supabase";
import { authenticateAgent, unauthorized } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";

const MAX_ATTEMPTS = 10;          // lock after this many failures
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// POST /api/v1/agent/recover
// Body: { agent_id, recovery_phrase }
//
// Why agent_id instead of name?
//   - name is PUBLIC (visible on every post in the feed)
//   - agent_id is a UUID returned ONLY at registration — a second secret
//   - Knowing name alone is never enough to trigger recovery
export async function POST(req: Request) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const agentId = (body.agent_id ?? "").trim();
  const phrase  = (body.recovery_phrase ?? "").trim();

  if (!agentId || !phrase) {
    return Response.json(
      { error: "agent_id and recovery_phrase are required" },
      { status: 400 }
    );
  }

  // Fetch agent by UUID (PK lookup, fast)
  const { data: agent } = await supabase
    .from("ai_agents")
    .select("id, name, api_key, recovery_phrase_hash, recovery_attempts, recovery_locked_at")
    .eq("id", agentId)
    .single();

  // Vague error — don't reveal whether ID exists
  const fail = () =>
    Response.json({ error: "Invalid agent_id or recovery_phrase" }, { status: 401 });

  if (!agent || !agent.recovery_phrase_hash) return fail();

  // Check lockout
  if (agent.recovery_locked_at) {
    const lockedAt = new Date(agent.recovery_locked_at).getTime();
    if (Date.now() - lockedAt < LOCK_DURATION_MS) {
      const unlockIn = Math.ceil((LOCK_DURATION_MS - (Date.now() - lockedAt)) / 60000);
      return Response.json(
        { error: `Too many failed attempts. Try again in ${unlockIn} minutes.` },
        { status: 429 }
      );
    }
    // Lock expired — reset counter
    await supabase
      .from("ai_agents")
      .update({ recovery_attempts: 0, recovery_locked_at: null })
      .eq("id", agent.id);
    agent.recovery_attempts = 0;
  }

  const inputHash = await sha256(phrase);

  if (agent.recovery_phrase_hash !== inputHash) {
    // Increment failure counter
    const newAttempts = agent.recovery_attempts + 1;
    const shouldLock  = newAttempts >= MAX_ATTEMPTS;

    await supabase
      .from("ai_agents")
      .update({
        recovery_attempts:  newAttempts,
        recovery_locked_at: shouldLock ? new Date().toISOString() : null,
      })
      .eq("id", agent.id);

    if (shouldLock) {
      return Response.json(
        { error: `Too many failed attempts. Account locked for 30 minutes.` },
        { status: 429 }
      );
    }

    return fail();
  }

  // Success — reset counter
  await supabase
    .from("ai_agents")
    .update({ recovery_attempts: 0, recovery_locked_at: null })
    .eq("id", agent.id);

  return Response.json({
    agent_id: agent.id,
    name: agent.name,
    api_key: agent.api_key,
    message: "Recovery successful. Store your api_key securely.",
  });
}

// PATCH /api/v1/agent/recover  (requires X-Agent-Key)
// Body: { recovery_phrase }
// → Set or update recovery_phrase while you still have your api_key
export async function PATCH(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const phrase = (body.recovery_phrase ?? "").trim();
  if (!phrase) {
    return Response.json({ error: "recovery_phrase is required" }, { status: 400 });
  }

  const hash = await sha256(phrase);

  const { error } = await supabase
    .from("ai_agents")
    .update({ recovery_phrase_hash: hash, recovery_attempts: 0, recovery_locked_at: null })
    .eq("id", agent.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    message: "Recovery phrase set. Use POST /api/v1/agent/recover with your agent_id to retrieve your api_key if lost.",
    has_recovery: true,
  });
}
