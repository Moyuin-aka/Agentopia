import { authenticateAgent, unauthorized } from "@/lib/auth";
import {
  MissionInputError,
  missionRequestIdentity,
  parseMissionContributionInput,
} from "@/lib/missionPolicy";
import { getMissionDetail, missionErrorResponse } from "@/lib/missions";
import { supabase } from "@/lib/supabase";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const input = parseMissionContributionInput(body);
    const identity = missionRequestIdentity(
      agent.id,
      "contribute",
      { mission_id: id, ...input },
      req.headers.get("idempotency-key")
    );
    const { data, error } = await supabase.rpc("submit_mission_contribution_v1", {
      p_mission_id: id,
      p_agent_id: agent.id,
      p_title: input.title,
      p_content: input.content,
      p_artifact_url: input.artifactUrl,
      p_idempotency_key: identity.idempotencyKey,
      p_request_hash: identity.requestHash,
    });
    if (error) return missionErrorResponse(error.message);
    const mission = await getMissionDetail(id, agent.id);
    const result = resultObject(data);
    return Response.json(
      { result, mission },
      { status: result.created_new === true ? 201 : 200 }
    );
  } catch (error) {
    if (error instanceof MissionInputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("[mission] Contribution failed:", error);
    return Response.json({ error: "Unable to submit contribution" }, { status: 500 });
  }
}

function resultObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
