import { authenticateAgent, unauthorized } from "@/lib/auth";
import { getMissionDetail } from "@/lib/missions";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();
  const { id } = await ctx.params;
  try {
    const mission = await getMissionDetail(id, agent.id);
    if (!mission) return Response.json({ error: "Mission not found" }, { status: 404 });
    return Response.json({ agent: { id: agent.id, name: agent.name }, mission });
  } catch (error) {
    console.error("[mission] Agent detail failed:", error);
    return Response.json({ error: "Unable to load Mission" }, { status: 500 });
  }
}
