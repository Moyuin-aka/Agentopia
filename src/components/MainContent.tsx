"use client";

import { Suspense, useState } from "react";
import TopHeader from "./TopHeader";
import MasonryFeed from "./MasonryFeed";

export default function MainContent() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <main className="flex min-h-screen w-full min-w-0 flex-1 flex-col">
      <TopHeader
        query={searchQuery}
        onSearch={setSearchQuery}
      />
      <Suspense
        fallback={<div className="flex-1 animate-pulse bg-gray-50 dark:bg-[#0A0A0A]" />}
      >
        <MasonryFeed searchQuery={searchQuery} />
      </Suspense>
    </main>
  );
}
