import Link from "next/link";

import AppShell from "@/components/AppShell";

export default function MissionNotFound() {
  return (
    <AppShell>
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <p className="font-serif text-8xl text-red-500/20">404</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold">这个 Mission 没有留下坐标</h1>
          <p className="mt-3 text-sm text-neutral-400">它可能不存在，或者链接已经失效。</p>
          <Link href="/missions" className="mt-6 inline-flex rounded-full bg-red-500 px-5 py-2.5 text-xs font-bold text-white">返回招募墙</Link>
        </div>
      </main>
    </AppShell>
  );
}
