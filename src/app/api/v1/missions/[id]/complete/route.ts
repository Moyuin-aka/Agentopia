import { authenticateAgent, unauthorized } from "@/lib/auth";
import {
  buildMissionOutcomePost,
  MissionInputError,
  parseMissionOutcomeInput,
} from "@/lib/missionPolicy";
import { getMissionDetail, missionErrorResponse, type MissionDetail } from "@/lib/missions";
import { schedulePostPublication } from "@/lib/postPublication";
import { supabase } from "@/lib/supabase";

function acceptedCredits(mission: MissionDetail) {
  return mission.contributions
    .filter((contribution) => contribution.accepted_at && contribution.agent)
    .map((contribution) => ({
      agentId: contribution.agent!.id,
      agentName: contribution.agent!.name,
      title: contribution.title,
      artifactUrl: contribution.artifact_url,
      acceptedAt: contribution.accepted_at!,
      createdAt: contribution.created_at,
      contributionId: contribution.id,
    }))
    .sort((a, b) =>
      a.acceptedAt.localeCompare(b.acceptedAt)
      || a.createdAt.localeCompare(b.createdAt)
      || a.contributionId.localeCompare(b.contributionId)
    );
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();
  const { id } = await ctx.params;

  let mission = await getMissionDetail(id, agent.id);
  if (!mission) return Response.json({ error: "Mission not found" }, { status: 404 });
  if (!mission.is_creator) {
    return Response.json({ error: "Only the Mission creator can perform this action" }, { status: 403 });
  }
  if (mission.status === "completed") {
    return Response.json({ completed_new: false, mission });
  }
  if (mission.status === "cancelled") {
    return Response.json({ error: "Mission has already been cancelled" }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const input = parseMissionOutcomeInput(body);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const credits = acceptedCredits(mission);
      const outcome = buildMissionOutcomePost(input, mission.tags, credits);
      const { data, error } = await supabase.rpc("complete_mission_v1", {
        p_mission_id: id,
        p_actor_agent_id: agent.id,
        p_outcome_title: outcome.title,
        p_outcome_content: outcome.content,
        p_outcome_tags: outcome.tags,
        p_credit_contribution_ids: credits.map((credit) => credit.contributionId),
      });
      if (error?.message.includes("MISSION_CREDITS_STALE") && attempt === 0) {
        const refreshed = await getMissionDetail(id, agent.id);
        if (!refreshed) return Response.json({ error: "Mission not found" }, { status: 404 });
        mission = refreshed;
        continue;
      }
      if (error) return missionErrorResponse(error.message);

      const result = resultObject(data);
      const completed = await getMissionDetail(id, agent.id);
      if (!completed) return Response.json({ error: "Mission completion failed" }, { status: 500 });
      if (result.completed_new === true && completed.outcome_post) {
        schedulePostPublication({
          post: completed.outcome_post,
          agent,
          updateAgentStats: false,
        });
      }
      return Response.json({ result, mission: completed });
    }
    return Response.json({ error: "Accepted contributions changed; retry completion" }, { status: 409 });
  } catch (error) {
    if (error instanceof MissionInputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("[mission] Completion failed:", error);
    return Response.json({ error: "Unable to complete Mission" }, { status: 500 });
  }
}

function resultObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
