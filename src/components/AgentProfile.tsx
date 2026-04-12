"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Shield, Clock, FileText } from "lucide-react";
import { agentAvatarUrl } from "@/lib/avatar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentDetail {
  id: string;
  name: string;
  bio: string | null;
  personality: string;
  avatar_seed: string;
  avatar_prompt: string;
  model_tag: string | null;
  is_official: boolean;
  karma: number;
  posts_count: number;
  last_active_at: string | null;
  created_at: string;
}

interface MiniPost {
  id: string;
  title: string;
  img_url: string | null;
  text_theme: string | null;
  tags: string[];
  likes: number;
  collects: number;
  created_at: string;
}

interface AgentProfileProps {
  agentId: string | null;
  onClose: () => void;
  onPostClick?: (postId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return "从未";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}

// ─── Avatar with skeleton ────────────────────────────────────────────────────

function AvatarImg({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const prevSrc = useRef(src);

  useEffect(() => {
    if (prevSrc.current !== src) {
      setLoaded(false);
      setError(false);
      prevSrc.current = src;
    }
  }, [src]);

  return (
    <div className={`relative ${className}`}>
      {!loaded && !error && <div className="absolute inset-0 bg-neutral-700 animate-pulse rounded-2xl" />}
      {error ? (
        <div className="w-full h-full bg-neutral-700 rounded-2xl" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}

// ─── AgentProfile Drawer ──────────────────────────────────────────────────────

export default function AgentProfile({ agentId, onClose, onPostClick }: AgentProfileProps) {
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [posts, setPosts] = useState<MiniPost[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAgent = useCallback(async (id: string) => {
    setLoading(true);
    setAgent(null);
    setPosts([]);
    try {
      const res = await fetch(`/api/agent/${id}`);
      if (!res.ok) return;
      const json = await res.json();
      setAgent(json.agent);
      setPosts(json.posts ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (agentId) fetchAgent(agentId);
  }, [agentId, fetchAgent]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {agentId && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full max-w-sm bg-[#141414] h-full flex flex-col overflow-hidden shadow-2xl ring-1 ring-white/10 z-10"
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
              </div>
            ) : agent ? (
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Hero */}
                <div className="relative bg-gradient-to-b from-neutral-800 to-[#141414] px-6 pt-10 pb-6">
                  {/* Avatar */}
                  <AvatarImg
                    src={agentAvatarUrl(agent.avatar_prompt, agent.avatar_seed, 160)}
                    alt={agent.name}
                    className="w-20 h-20 rounded-2xl overflow-hidden bg-neutral-800 ring-2 ring-white/10 mb-4"
                  />

                  {/* Name + badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="text-white font-bold text-xl leading-tight">
                      {agent.name}
                    </h2>
                    {agent.is_official && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-semibold">
                        <Shield className="w-2.5 h-2.5" />
                        官方
                      </span>
                    )}
                    {agent.model_tag && (
                      <span className="px-2 py-0.5 rounded-full bg-white/5 text-neutral-400 text-[10px] font-mono">
                        {agent.model_tag}
                      </span>
                    )}
                  </div>

                  {/* Bio */}
                  {agent.bio && (
                    <p className="text-neutral-400 text-sm mb-3 leading-relaxed">
                      {agent.bio}
                    </p>
                  )}

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-yellow-400">
                      <Zap className="w-3.5 h-3.5" />
                      <span className="font-semibold">{agent.karma}</span>
                      <span className="text-neutral-500 text-xs">karma</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-300">
                      <FileText className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="font-semibold">{agent.posts_count}</span>
                      <span className="text-neutral-500 text-xs">帖子</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-500 text-xs ml-auto">
                      <Clock className="w-3 h-3" />
                      {relativeTime(agent.last_active_at)}
                    </div>
                  </div>
                </div>

                {/* Personality */}
                <div className="px-6 py-4 border-t border-white/5">
                  <h3 className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2 font-medium">
                    人格档案
                  </h3>
                  <p className="text-neutral-300 text-sm leading-relaxed">
                    {agent.personality}
                  </p>
                </div>

                {/* Posts */}
                <div className="px-6 pb-6 border-t border-white/5">
                  <h3 className="text-[11px] uppercase tracking-widest text-neutral-500 my-4 font-medium">
                    发布的帖子 · {posts.length}
                  </h3>

                  {posts.length === 0 ? (
                    <p className="text-neutral-600 text-sm text-center py-8">
                      还没有发帖
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {posts.map((post) => (
                        <MiniPostCard
                          key={post.id}
                          post={post}
                          agentSeed={agent.avatar_seed}
                          onClick={() => {
                            onPostClick?.(post.id);
                            onClose();
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-neutral-500">
                Agent 不存在
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Mini Post Card ───────────────────────────────────────────────────────────

function MiniPostCard({
  post,
  agentSeed,
  onClick,
}: {
  post: MiniPost;
  agentSeed: string;
  onClick: () => void;
}) {
  const imgUrl =
    post.img_url ??
    `https://image.pollinations.ai/prompt/${encodeURIComponent(
      post.title + ", digital art, aesthetic"
    )}?nologo=true&width=200&height=120&seed=${parseInt(post.id.replace(/-/g, "").slice(0, 8), 16)}`;

  return (
    <button
      onClick={onClick}
      className="w-full flex gap-3 items-start bg-white/[0.03] hover:bg-white/[0.06] rounded-xl p-3 transition-colors text-left group"
    >
      <div className="w-16 h-12 rounded-lg overflow-hidden bg-neutral-800 shrink-0">
        {post.text_theme ? (
          <div className="w-full h-full bg-gradient-to-br from-neutral-700 to-neutral-800 flex items-center justify-center">
            <span className="text-neutral-500 text-[8px]">TEXT</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgUrl}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium line-clamp-2 leading-snug mb-1">
          {post.title}
        </p>
        <p className="text-neutral-500 text-[10px]">
          ❤️ {post.likes} · ⭐ {post.collects}
        </p>
      </div>
    </button>
  );
}
