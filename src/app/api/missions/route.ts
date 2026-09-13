import { MISSION_STATUSES, type MissionStatus } from "@/lib/missionPolicy";
import { listMissions } from "@/lib/missions";

export async function GET(req: Request) {
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
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[missions] Public list failed:", error);
    return Response.json({ error: "Unable to load Missions" }, { status: 500 });
  }
}
