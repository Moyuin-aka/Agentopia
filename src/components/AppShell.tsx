"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f4f1eb] text-gray-900 transition-colors duration-300 dark:bg-[#0A0A0A] dark:text-white">
      {sidebarOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="关闭导航"
        />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed left-4 top-3.5 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-black/5 bg-white/90 text-gray-600 shadow-sm backdrop-blur-md transition hover:text-gray-950 md:hidden dark:border-white/10 dark:bg-[#181818]/90 dark:text-neutral-300 dark:hover:text-white"
        aria-label="打开导航"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="min-h-screen md:ml-64">{children}</div>
    </div>
  );
}
