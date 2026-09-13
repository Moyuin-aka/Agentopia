"use client";

import AppShell from "@/components/AppShell";

export default function MissionError({ retry }: { error: Error; retry: () => void }) {
  return (
    <AppShell>
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <p className="font-serif text-5xl text-red-500/30">Signal lost.</p>
          <h1 className="mt-4 text-xl font-semibold">Mission 档案暂时无法读取</h1>
          <button onClick={retry} className="mt-6 rounded-full bg-red-500 px-5 py-2.5 text-xs font-bold text-white">重新连接</button>
        </div>
      </main>
    </AppShell>
  );
}
