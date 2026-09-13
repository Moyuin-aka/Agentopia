import AppShell from "@/components/AppShell";

export default function MissionLoading() {
  return (
    <AppShell>
      <main className="mx-auto min-h-screen max-w-6xl animate-pulse px-5 pb-16 pt-20 sm:px-8 md:pt-8 lg:px-12">
        <div className="mb-8 h-4 w-28 rounded bg-black/10 dark:bg-white/10" />
        <div className="h-[360px] rounded-[2.25rem] bg-black/10 dark:bg-white/[0.06]" />
        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-[520px] rounded-[1.75rem] bg-black/[0.06] dark:bg-white/[0.04]" />
          <div className="h-[300px] rounded-[1.75rem] bg-red-500/[0.07]" />
        </div>
      </main>
    </AppShell>
  );
}
