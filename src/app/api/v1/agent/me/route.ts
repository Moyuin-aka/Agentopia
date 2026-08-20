import { supabase } from "@/lib/supabase";
import { authenticateAgent, unauthorized } from "@/lib/auth";
import { getAgentAuthorizationContext } from "@/lib/authorization";

// GET /api/v1/agent/me
export async function GET(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  const authorization = await getAgentAuthorizationContext(agent.id);
  if (!authorization) {
    return Response.json(
      { error: "Unable to load authorization context" },
      { status: 503 }
    );
  }

  return Response.json({ agent, authorization });
}

// PATCH /api/v1/agent/me
// Updatable fields: name, bio, model_tag, avatar_prompt, avatar_seed, personality
export async function PATCH(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const allowed = ["name", "bio", "model_tag", "avatar_prompt", "avatar_seed", "personality"] as const;
  const nullableFields = new Set<(typeof allowed)[number]>(["bio", "model_tag"]);
  const updates: {
    name?: string;
    bio?: string | null;
    model_tag?: string | null;
    avatar_prompt?: string;
    avatar_seed?: string;
    personality?: string;
  } = {};

  for (const field of allowed) {
    if (field in body) {
      const val = body[field]?.trim() ?? null;
      if (!val && !nullableFields.has(field)) {
        return Response.json(
          { error: `${field} cannot be empty` },
          { status: 400 }
        );
      }

      if (field === "bio" || field === "model_tag") {
        updates[field] = val || null;
      } else if (field === "name") {
        updates.name = val as string;
      } else if (field === "avatar_prompt") {
        updates.avatar_prompt = val as string;
      } else if (field === "avatar_seed") {
        updates.avatar_seed = val as string;
      } else if (field === "personality") {
        updates.personality = val as string;
      }
    }
  }

  // Validate lengths
  if (updates.name !== undefined) {
    if (!updates.name) return Response.json({ error: "name cannot be empty" }, { status: 400 });
    if (updates.name.length > 50) return Response.json({ error: "name must be 50 characters or fewer" }, { status: 400 });

    // Check uniqueness (exclude self)
    const { data: existing } = await supabase
      .from("ai_agents")
      .select("id")
      .eq("name", updates.name)
      .neq("id", agent.id)
      .single();
    if (existing) return Response.json({ error: `Name "${updates.name}" is already taken` }, { status: 409 });
  }

  if (updates.avatar_prompt && updates.avatar_prompt.length > 200) {
    return Response.json({ error: "avatar_prompt must be 200 characters or fewer" }, { status: 400 });
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
    .select("id, name, bio, personality, avatar_seed, avatar_prompt, model_tag, is_official, verification_status, verification_label, verified_at, karma, posts_count, last_active_at, created_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    message: "Profile updated.",
    agent: data,
  });
}
