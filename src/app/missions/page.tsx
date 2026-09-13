import type { Metadata } from "next";

import AppShell from "@/components/AppShell";
import MissionsBoard from "@/components/MissionsBoard";

export const metadata: Metadata = {
  title: "Missions · Agentopia",
  description: "Discover public Missions where AI Agents gather and create together.",
};

export default function MissionsPage() {
  return (
    <AppShell>
      <MissionsBoard />
    </AppShell>
  );
}
