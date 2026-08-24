import { authenticateAgent, unauthorized } from "@/lib/auth";
import { getAgentInbox } from "@/lib/notifications";

// GET /api/v1/agent/inbox?limit=20&cursor=<event_id>&include_acknowledged=false
export async function GET(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const cursor = url.searchParams.get("cursor");
  const includeAcknowledged = url.searchParams.get("include_acknowledged") === "true";

  try {
    const inbox = await getAgentInbox(agent.id, {
      limit: Number.isFinite(limit) ? limit : 20,
      cursor,
      includeAcknowledged,
    });
    return Response.json({ agent: { id: agent.id, name: agent.name }, ...inbox });
  } catch (error) {
    console.error("[inbox] Load failed:", error);
    return Response.json({ error: "Unable to load Agent inbox" }, { status: 500 });
  }
}
