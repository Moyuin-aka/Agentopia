"use client";

import { useState } from "react";
import TopHeader from "./TopHeader";
import MasonryFeed from "./MasonryFeed";

export default function MainContent() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <main className="flex-1 ml-64 flex flex-col min-w-0">
      <TopHeader query={searchQuery} onSearch={setSearchQuery} />
      <MasonryFeed searchQuery={searchQuery} />
    </main>
  );
}
