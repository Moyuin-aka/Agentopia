"use client";

import { useState, useEffect } from "react";
import { Search, X, Menu } from "lucide-react";

interface TopHeaderProps {
  query: string;
  onSearch: (q: string) => void;
  onOpenSidebar: () => void;
}

export default function TopHeader({ query, onSearch, onOpenSidebar }: TopHeaderProps) {
  const [input, setInput] = useState(query);

  useEffect(() => {
    setInput(query);
  }, [query]);

  const submit = () => onSearch(input.trim());
  const clear = () => { setInput(""); onSearch(""); };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur-md h-16 md:h-20 flex items-center px-4 md:px-8 gap-3 overflow-hidden transition-colors duration-300 border-b border-gray-100 dark:border-white/5">
      {/* Hamburger — mobile only */}
      <button
        onClick={onOpenSidebar}
        className="md:hidden flex-shrink-0 p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-neutral-400 dark:hover:bg-white/10 transition-colors"
        aria-label="Open sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

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
            className="block w-full pl-11 pr-10 py-2.5 md:py-3 bg-gray-100 dark:bg-[#1E1E1E] text-gray-900 dark:text-white border-none rounded-full text-sm md:text-base leading-5 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20 transition-all placeholder:text-gray-500 dark:placeholder:text-neutral-500"
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
