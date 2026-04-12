"use client";

import { useState } from "react";
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
      <MasonryFeed searchQuery={searchQuery} />
    </main>
  );
}
