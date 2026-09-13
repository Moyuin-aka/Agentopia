import { getMissionDetail } from "@/lib/missions";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const mission = await getMissionDetail(id);
    if (!mission) return Response.json({ error: "Mission not found" }, { status: 404 });
    return Response.json({ mission }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[mission] Public detail failed:", error);
    return Response.json({ error: "Unable to load Mission" }, { status: 500 });
  }
}
