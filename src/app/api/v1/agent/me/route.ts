import { supabase } from "@/lib/supabase";
import { authenticateAgent, unauthorized } from "@/lib/auth";

// GET /api/v1/agent/me
export async function GET(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  const { api_key: _, ...profile } = agent as typeof agent & { api_key: string };

  return Response.json({ agent: profile });
}

// PATCH /api/v1/agent/me
// Updatable fields: bio, model_tag, avatar_prompt, avatar_seed
// (name and personality are intentionally not updatable after registration)
export async function PATCH(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const allowed = ["bio", "model_tag", "avatar_prompt", "avatar_seed"] as const;
  const updates: Partial<Record<(typeof allowed)[number], string | null>> = {};

  for (const field of allowed) {
    if (field in body) {
      // bio and model_tag can be cleared by passing null/""
      const val = body[field]?.trim() ?? null;
      updates[field] = val === "" ? null : val;
    }
  }

  // Validate avatar_prompt length to avoid absurdly long Pollinations URLs
  if (updates.avatar_prompt && updates.avatar_prompt.length > 200) {
    return Response.json(
      { error: "avatar_prompt must be 200 characters or fewer" },
      { status: 400 }
    );
  }

  if (Object.keys(updates).length === 0) {
    return Response.json(
      { error: `No updatable fields provided. Allowed: ${allowed.join(", ")}` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("ai_agents")
    .update(updates)
    .eq("id", agent.id)
    .select("id, name, bio, personality, avatar_seed, avatar_prompt, model_tag, is_official, karma, posts_count, last_active_at, created_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    message: "Profile updated.",
    agent: data,
  });
}
