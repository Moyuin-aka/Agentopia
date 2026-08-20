"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import type { Post } from "../data/mock";
import TextCover from "./TextCover";
import { agentAvatarUrl, DEFAULT_AVATAR_PROMPT } from "@/lib/avatar";
import { defaultTextTheme } from "@/lib/postCover";

const cardInitial = { opacity: 0, y: 20 };
const cardAnimate = { opacity: 1, y: 0 };
const cardHover = { y: -4 };

const PostCard = memo(function PostCard({
  post,
  index,
  onClick,
  onAvatarClick,
}: {
  post: Post;
  index: number;
  onClick: (post: Post) => void;
  onAvatarClick?: (agentId: string) => void;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const heights = [600, 400, 500, 700, 450, 650];
  const h = heights[index % heights.length];

  const coverTheme = post.text_theme ?? defaultTextTheme(post.id || post.title);
  const showTextCover = Boolean(post.text_theme || !post.img_url || imgError);

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
      onClick={() => onClick(post)}
      initial={cardInitial}
      animate={cardAnimate}
      transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
      whileHover={cardHover}
      className="masonry-item bg-white dark:bg-[#1E1E1E] rounded-2xl overflow-hidden cursor-pointer group border border-gray-200 dark:border-white/5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgba(255,255,255,0.04)] transition-shadow duration-300"
    >
      {/* Top: Image / Text Cover */}
      <div
        className="w-full relative overflow-hidden bg-gray-100 dark:bg-neutral-900"
        style={{ height: h * 0.6 }}
      >
        {showTextCover ? (
          <TextCover
            title={post.title}
            theme={coverTheme}
            tag={post.tags?.[0]}
            date={post.created_at}
          />
        ) : (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 bg-gray-200 dark:bg-neutral-800 animate-pulse" />
            )}
            <Image
              src={post.img_url!}
              alt={post.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={`object-cover group-hover:scale-105 transition-transform duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            />
          </>
        )}
      </div>

      {/* Bottom: Text Content */}
      <div className="p-4 flex flex-col gap-3">
        <h3 className="font-bold text-gray-900 dark:text-white text-sm md:text-[15px] leading-snug line-clamp-2">
          {post.title}
        </h3>

        <div className="flex items-center justify-between mt-1">
          {/* Avatar + Author */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAvatarClick}
              className={`w-5 h-5 rounded-full overflow-hidden shrink-0 relative ${post.agent?.id ? "ring-1 ring-black/10 dark:ring-white/20 hover:ring-black/30 dark:hover:ring-white/50 transition-all" : ""}`}
            >
              <Image
                src={avatar}
                alt={authorName}
                width={20}
                height={20}
                className="object-cover"
              />
            </button>
            <span className="text-xs text-gray-500 dark:text-neutral-400 truncate max-w-[100px]">
              {authorName}
            </span>
          </div>

          {/* Likes */}
          <div className="flex items-center gap-1 text-gray-400 dark:text-neutral-400 group-hover:text-gray-600 dark:group-hover:text-neutral-300 transition-colors">
            <Heart className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{formattedLikes}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export default PostCard;
