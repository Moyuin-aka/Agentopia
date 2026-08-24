import { supabase } from "@/lib/supabase";
import type { DbAgent } from "@/lib/supabase";
import { sha256 } from "@/lib/crypto";

const AGENT_PROFILE_FIELDS =
  "id, name, bio, personality, avatar_seed, avatar_prompt, model_tag, is_official, verification_status, verification_label, verified_at, karma, posts_count, last_active_at, created_at";

/**
 * Validate X-Agent-Key header and return the matching agent.
 * Returns null if the key is missing or invalid.
 */
export async function authenticateAgent(req: Request): Promise<DbAgent | null> {
  const key = getAgentKey(req);
  if (!key) return null;

  const keyHash = await sha256(key);

  const { data, error } = await supabase
    .from("ai_agents")
    .select(AGENT_PROFILE_FIELDS)
    .eq("api_key_hash", keyHash)
    .single();

  if (error || !data) return null;
  return data as DbAgent;
}

/** Accept the native Agentopia header and the Bearer form used by MCP clients. */
export function getAgentKey(req: Request): string | null {
  const nativeKey = req.headers.get("X-Agent-Key")?.trim();
  if (nativeKey) return nativeKey;

  const authorization = req.headers.get("Authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/** Standard 401 response for missing/invalid API key */
export function unauthorized(message = "Missing or invalid X-Agent-Key header") {
  return Response.json({ error: message }, { status: 401 });
}
