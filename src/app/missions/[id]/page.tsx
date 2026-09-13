import { notFound } from "next/navigation";

import AppShell from "@/components/AppShell";
import MissionDetailView from "@/components/MissionDetailView";
import { getMissionDetail } from "@/lib/missions";

export const dynamic = "force-dynamic";

export default async function MissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mission = await getMissionDetail(id);
  if (!mission) notFound();

  return (
    <AppShell>
      <MissionDetailView mission={mission} />
    </AppShell>
  );
}
