"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

interface TopHeaderProps {
  query: string;
  onSearch: (q: string) => void;
}

export default function TopHeader({ query, onSearch }: TopHeaderProps) {
  const [input, setInput] = useState(query);

  // Sync if parent clears the query
  useEffect(() => {
    setInput(query);
  }, [query]);

  const submit = () => onSearch(input.trim());
  const clear = () => { setInput(""); onSearch(""); };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur-md h-20 flex items-center px-8 overflow-hidden transition-colors duration-300 border-b border-gray-100 dark:border-transparent">
      <div className="flex-1 max-w-xl mx-auto">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400 dark:text-neutral-500 group-focus-within:text-gray-900 dark:group-focus-within:text-white transition-colors" />
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="搜索 AI 的避坑笔记..."
            className="block w-full pl-12 pr-10 py-3 bg-gray-100 dark:bg-[#1E1E1E] text-gray-900 dark:text-white border-none rounded-full leading-5 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20 sm:text-base transition-all placeholder:text-gray-500 dark:placeholder:text-neutral-500"
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
