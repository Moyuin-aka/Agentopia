"use client";

import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import type { Post } from "../data/mock";
import TextCover from "./TextCover";
import { agentAvatarUrl, DEFAULT_AVATAR_PROMPT } from "@/lib/avatar";

export default function PostCard({
  post,
  index,
  onClick,
  onAvatarClick,
}: {
  post: Post;
  index: number;
  onClick: () => void;
  onAvatarClick?: (agentId: string) => void;
}) {
  const heights = [600, 400, 500, 700, 450, 650];
  const h = heights[index % heights.length];

  const imgUrl =
    post.img_url ??
    `https://image.pollinations.ai/prompt/${encodeURIComponent(
      post.title + ", digital art, aesthetic"
    )}?nologo=true&width=400&height=${h}&seed=${post.id}`;

  const formattedLikes =
    post.likes >= 1000
      ? `${(post.likes / 1000).toFixed(1)}k`
      : String(post.likes);

  const avatar = post.agent
    ? agentAvatarUrl(post.agent.avatar_prompt, post.agent.avatar_seed, 50)
    : agentAvatarUrl(DEFAULT_AVATAR_PROMPT, post.id, 50);

  const authorName = post.agent?.name ?? post.author;

  const handleAvatarClick = (e: React.MouseEvent) => {
    if (post.agent?.id && onAvatarClick) {
      e.stopPropagation();
      onAvatarClick(post.agent.id);
    }
  };

  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
      whileHover={{ y: -4 }}
      className="masonry-item bg-[#1E1E1E] rounded-xl overflow-hidden cursor-pointer group border border-white/5 hover:shadow-[0_8px_30px_rgba(255,255,255,0.04)] transition-shadow duration-300"
    >
      {/* Top: Image / Text Cover */}
      <div
        className="w-full relative overflow-hidden bg-neutral-900"
        style={{ height: h * 0.6 }}
      >
        {post.text_theme ? (
          <TextCover title={post.title} theme={post.text_theme} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgUrl}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        )}
      </div>

      {/* Bottom: Text Content */}
      <div className="p-4 flex flex-col gap-3">
        <h3 className="font-bold text-white text-sm md:text-[15px] leading-snug line-clamp-2">
          {post.title}
        </h3>

        <div className="flex items-center justify-between mt-1">
          {/* Avatar + Author */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAvatarClick}
              className={`w-5 h-5 rounded-full overflow-hidden shrink-0 ${post.agent?.id ? "ring-1 ring-white/20 hover:ring-white/50 transition-all" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatar}
                alt={authorName}
                className="w-full h-full object-cover"
              />
            </button>
            <span className="text-xs text-neutral-400 truncate max-w-[100px]">
              {authorName}
            </span>
          </div>

          {/* Likes */}
          <div className="flex items-center gap-1 text-neutral-400 group-hover:text-neutral-300 transition-colors">
            <Heart className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{formattedLikes}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
