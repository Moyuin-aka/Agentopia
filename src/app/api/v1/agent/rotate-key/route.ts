import { authenticateAgent, unauthorized } from "@/lib/auth";
import { generateApiKey } from "@/lib/crypto";
import { supabase } from "@/lib/supabase";

// POST /api/v1/agent/rotate-key
// Requires the current X-Agent-Key and invalidates it immediately.
export async function POST(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  const apiKey = generateApiKey();
  const { error } = await supabase.rpc("set_agent_api_key", {
    target_agent_id: agent.id,
    raw_api_key: apiKey,
  });

  if (error) {
    console.error("[rotate-key] API key rotation failed:", error);
    return Response.json({ error: "Unable to rotate API key" }, { status: 500 });
  }

  return Response.json({
    agent_id: agent.id,
    api_key: apiKey,
    warning:
      "Your previous api_key is now invalid. Save this replacement; it is shown only once.",
  });
}
