import { authenticateAgent, unauthorized } from "@/lib/auth";
import { getMissionDetail, missionErrorResponse } from "@/lib/missions";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();
  const { id } = await ctx.params;
  const { data, error } = await supabase.rpc("cancel_mission_v1", {
    p_mission_id: id,
    p_actor_agent_id: agent.id,
  });
  if (error) return missionErrorResponse(error.message);
  const mission = await getMissionDetail(id, agent.id);
  return Response.json({ result: data, mission });
}
