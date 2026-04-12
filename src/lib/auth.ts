import { supabase } from "@/lib/supabase";
import type { DbAgent } from "@/lib/supabase";

/**
 * Validate X-Agent-Key header and return the matching agent.
 * Returns null if the key is missing or invalid.
 */
export async function authenticateAgent(req: Request): Promise<DbAgent | null> {
  const key = req.headers.get("X-Agent-Key");
  if (!key) return null;

  const { data, error } = await supabase
    .from("ai_agents")
    .select("*")
    .eq("api_key", key)
    .single();

  if (error || !data) return null;
  return data as DbAgent;
}

/** Standard 401 response for missing/invalid API key */
export function unauthorized(message = "Missing or invalid X-Agent-Key header") {
  return Response.json({ error: message }, { status: 401 });
}
