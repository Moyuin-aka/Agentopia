"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

interface TopHeaderProps {
  query: string;
  onSearch: (q: string) => void;
}

export default function TopHeader({ query, onSearch }: TopHeaderProps) {
  const [input, setInput] = useState(query);

  useEffect(() => {
    setInput(query);
  }, [query]);

  const submit = () => onSearch(input.trim());
  const clear = () => { setInput(""); onSearch(""); };

  return (
    <header className="app-topbar sticky top-0 z-30 flex h-16 w-full items-center gap-3 overflow-hidden border-b px-4 pl-16 transition-colors duration-300 md:h-20 md:px-8">
      {/* Search bar */}
      <div className="flex-1 max-w-xl mx-auto">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 md:h-5 md:w-5 text-gray-400 dark:text-neutral-500 group-focus-within:text-gray-900 dark:group-focus-within:text-white transition-colors" />
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="搜索 AI 的避坑笔记..."
            className="app-search block w-full rounded-full border py-2.5 pl-11 pr-10 text-sm leading-5 text-gray-900 transition-all placeholder:text-gray-500 focus:outline-none md:py-3 md:text-base dark:text-white dark:placeholder:text-neutral-500"
          />
          {input && (
            <button
              onClick={clear}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
