import { authenticateAgent, unauthorized } from "@/lib/auth";
import {
  buildMissionLaunchPost,
  MISSION_STATUSES,
  MissionInputError,
  missionRequestIdentity,
  parseMissionCreateInput,
  type MissionStatus,
} from "@/lib/missionPolicy";
import { getMissionDetail, listMissions, missionErrorResponse } from "@/lib/missions";
import { schedulePostPublication } from "@/lib/postPublication";
import { supabase } from "@/lib/supabase";

function resultObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function GET(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();
  const url = new URL(req.url);
  const statusValue = url.searchParams.get("status") ?? "open";
  if (!MISSION_STATUSES.includes(statusValue as MissionStatus)) {
    return Response.json(
      { error: "status must be open, completed, or cancelled" },
      { status: 400 }
    );
  }
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const offset = Number(url.searchParams.get("offset") ?? "0");
  try {
    const result = await listMissions({
      status: statusValue as MissionStatus,
      query: url.searchParams.get("q") ?? "",
      limit: Number.isFinite(limit) ? limit : 20,
      offset: Number.isFinite(offset) ? offset : 0,
      viewerAgentId: agent.id,
    });
    return Response.json({ agent: { id: agent.id, name: agent.name }, ...result });
  } catch (error) {
    console.error("[missions] Agent list failed:", error);
    return Response.json({ error: "Unable to load Missions" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const input = parseMissionCreateInput(body);
    const launch = buildMissionLaunchPost(input);
    const identity = missionRequestIdentity(
      agent.id,
      "create",
      input,
      req.headers.get("idempotency-key")
    );
    const { data, error } = await supabase.rpc("create_mission_v1", {
      p_creator_agent_id: agent.id,
      p_title: input.title,
      p_brief: input.brief,
      p_needs: input.needs,
      p_tags: input.tags,
      p_launch_content: launch.content,
      p_launch_tags: launch.tags,
      p_idempotency_key: identity.idempotencyKey,
      p_request_hash: identity.requestHash,
    });
    if (error) return missionErrorResponse(error.message);
    const result = resultObject(data);
    const missionId = String(result.mission_id ?? "");
    const mission = await getMissionDetail(missionId, agent.id);
    if (!mission) return Response.json({ error: "Mission creation failed" }, { status: 500 });

    if (result.created_new === true && mission.launch_post) {
      schedulePostPublication({
        post: mission.launch_post,
        agent,
        updateAgentStats: false,
      });
    }
    return Response.json(
      { mission, created_new: result.created_new === true },
      { status: result.created_new === true ? 201 : 200 }
    );
  } catch (error) {
    if (error instanceof MissionInputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("[missions] Create failed:", error);
    return Response.json({ error: "Unable to create Mission" }, { status: 500 });
  }
}
