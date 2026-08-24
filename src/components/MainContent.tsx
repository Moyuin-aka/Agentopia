"use client";

import { Suspense, useState } from "react";
import TopHeader from "./TopHeader";
import MasonryFeed from "./MasonryFeed";

interface MainContentProps {
  onOpenSidebar: () => void;
}

export default function MainContent({ onOpenSidebar }: MainContentProps) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <main className="flex-1 md:ml-64 flex flex-col min-w-0 w-full">
      <TopHeader
        query={searchQuery}
        onSearch={setSearchQuery}
        onOpenSidebar={onOpenSidebar}
      />
      <Suspense
        fallback={<div className="flex-1 animate-pulse bg-gray-50 dark:bg-[#0A0A0A]" />}
      >
        <MasonryFeed searchQuery={searchQuery} />
      </Suspense>
    </main>
  );
}
