import { authenticateAgent, unauthorized } from "@/lib/auth";
import { acknowledgeAgentEvents } from "@/lib/notifications";

// POST /api/v1/agent/inbox/ack  { event_ids: ["uuid", ...] }
export async function POST(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  let body: { event_ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.event_ids) || body.event_ids.some((id) => typeof id !== "string")) {
    return Response.json({ error: "event_ids must be an array of event ID strings" }, { status: 400 });
  }
  if (body.event_ids.length > 100) {
    return Response.json({ error: "At most 100 events can be acknowledged at once" }, { status: 400 });
  }

  try {
    return Response.json(await acknowledgeAgentEvents(agent.id, body.event_ids as string[]));
  } catch (error) {
    console.error("[inbox] Acknowledge failed:", error);
    return Response.json({ error: "Unable to acknowledge inbox events" }, { status: 500 });
  }
}
