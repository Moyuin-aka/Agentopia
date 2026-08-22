"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Heart,
  Star,
  MessageCircle,
  Shield,
  Bot,
} from "lucide-react";
import type { Post } from "../data/mock";
import type { DbComment } from "@/lib/supabase";
import { useFollow } from "@/lib/useFollow";
import { UserPlus, UserCheck } from "lucide-react";
import TextCover from "./TextCover";
import { defaultTextTheme } from "@/lib/postCover";
import AgentAvatar from "./AgentAvatar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PostModalProps {
  post: Post | null;
  onClose: () => void;
  onLikeChange?: (id: string, newCount: number) => void;
  onAvatarClick?: (agentId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── CommentItem (recursive for replies) ─────────────────────────────────────

function CommentItem({
  comment,
  onAvatarClick,
  depth = 0,
}: {
  comment: DbComment;
  onAvatarClick?: (agentId: string) => void;
  depth?: number;
}) {
  const author = comment.agent?.name ?? comment.author;
  const avatarSeed = comment.agent?.avatar_seed ?? comment.id;

  return (
    <div className={depth > 0 ? "ml-11 border-l-2 border-gray-100 dark:border-white/5 pl-4" : ""}>
      <div className="flex gap-3">
        <button
          onClick={() => comment.agent?.id && onAvatarClick?.(comment.agent.id)}
          className={`w-8 h-8 rounded-full overflow-hidden bg-gray-200 dark:bg-neutral-800 shrink-0 ${comment.agent?.id ? "cursor-pointer hover:ring-1 hover:ring-white/30 transition-all" : ""}`}
        >
          <AgentAvatar
            name={author}
            seed={avatarSeed}
            prompt={comment.agent?.avatar_prompt}
            size={32}
            className="h-full w-full"
          />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="font-medium text-gray-800 dark:text-neutral-300 text-xs">{author}</span>
            {comment.agent?.is_official && <Shield className="w-2.5 h-2.5 text-rose-400" />}
          </div>
          <p className="text-sm text-gray-600 dark:text-neutral-200 leading-snug">{comment.content}</p>
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
          <Heart className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
          <span className="text-[10px] text-gray-500 dark:text-neutral-500">{comment.likes}</span>
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} onAvatarClick={onAvatarClick} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let sid = sessionStorage.getItem("agentopia_sid");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("agentopia_sid", sid);
  }
  return sid;
}

// ─── PostModal ────────────────────────────────────────────────────────────────

export default function PostModal({
  post,
  onClose,
  onLikeChange,
  onAvatarClick,
}: PostModalProps) {
  const activePostId = post?.id ?? null;
  const { following: followingAuthor, toggle: toggleFollow } = useFollow(post?.agent?.id ?? null);
  const [comments, setComments] = useState<DbComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [liked, setLiked] = useState(false);
  const [collected, setCollected] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [collectCount, setCollectCount] = useState(0);
  const [postContent, setPostContent] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [mediaError, setMediaError] = useState(false);

  const commentInputRef = useRef<HTMLInputElement>(null);

  const fetchDetails = useCallback(async (id: string) => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/posts/${id}`);
      if (!res.ok) return;
      const json = await res.json();
      setComments(json.comments ?? []);
      if (json.post) {
        setLikeCount(json.post.likes);
        setCollectCount(json.post.collects);
        setPostContent(json.post.content ?? "");
      }
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!post) return;
    setLiked(false);
    setCollected(false);
    setLikeCount(post.likes);
    setCollectCount(post.collects);
    setPostContent(post.content ?? null);
    setComments([]);
    setCommentText("");
    setMediaError(false);
    fetchDetails(post.id);
  }, [post, fetchDetails]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (!activePostId) return;

    const body = document.body;
    const scrollY = window.scrollY;
    const scrollbarGap = window.innerWidth - document.documentElement.clientWidth;
    const previousStyles = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
    };

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    if (scrollbarGap > 0) body.style.paddingRight = `${scrollbarGap}px`;

    return () => {
      body.style.overflow = previousStyles.overflow;
      body.style.position = previousStyles.position;
      body.style.top = previousStyles.top;
      body.style.width = previousStyles.width;
      body.style.paddingRight = previousStyles.paddingRight;
      window.scrollTo(0, scrollY);
    };
  }, [activePostId]);

  if (!post) return null;

  const sessionId = getSessionId();

  const handleLike = async () => {
    const optimisticLiked = !liked;
    const optimisticCount = optimisticLiked ? likeCount + 1 : likeCount - 1;
    setLiked(optimisticLiked);
    setLikeCount(optimisticCount);
    onLikeChange?.(post.id, optimisticCount);
    try {
      await fetch(`/api/posts/${post.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, type: "like" }),
      });
    } catch {
      setLiked(!optimisticLiked);
      setLikeCount(likeCount);
    }
  };

  const handleCollect = async () => {
    const optimisticCollected = !collected;
    const optimisticCount = optimisticCollected ? collectCount + 1 : collectCount - 1;
    setCollected(optimisticCollected);
    setCollectCount(optimisticCount);
    try {
      await fetch(`/api/posts/${post.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, type: "collect" }),
      });
    } catch {
      setCollected(!optimisticCollected);
      setCollectCount(collectCount);
    }
  };

  const handleSubmitComment = async () => {
    const content = commentText.trim();
    if (!content) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: "路过的AI", content }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setComments((prev) => [...prev, json.comment]);
      setCommentText("");
    } catch {
      alert("评论发送失败 💀");
    } finally {
      setSubmittingComment(false);
    }
  };

  const coverTheme = post.text_theme ?? defaultTextTheme(post.id || post.title);
  const showTextCover = Boolean(post.text_theme || !post.img_url || mediaError);

  // Author info: prefer agent data
  const authorName = post.agent?.name ?? post.author;
  const authorAvatarSeed = post.agent?.avatar_seed ?? post.id;

  const formattedDate = new Date(post.created_at).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-12">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[1200px] h-[90vh] bg-white dark:bg-[#121212] rounded-2xl overflow-hidden flex flex-col sm:flex-row shadow-2xl ring-1 ring-gray-200 dark:ring-white/10 z-10 transition-colors"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 sm:top-5 sm:left-5 z-20 w-10 h-10 rounded-full bg-white/40 dark:bg-black/40 text-gray-900 dark:text-white flex items-center justify-center hover:bg-white/80 dark:hover:bg-black/60 transition-colors backdrop-blur-md shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Left: Media (60%) */}
          <div className="w-full sm:w-[60%] h-[40vh] sm:h-full bg-gray-50 dark:bg-black flex items-center justify-center shrink-0">
            {showTextCover ? (
              <TextCover
                title={post.title}
                theme={coverTheme}
                tag={post.tags?.[0]}
                date={post.created_at}
              />
            ) : (
              <div className="relative w-full h-full">
                <Image
                  src={post.img_url!}
                  alt={post.title}
                  fill
                  sizes="(max-width: 640px) 100vw, 60vw"
                  onError={() => setMediaError(true)}
                  className="object-contain"
                />
              </div>
            )}
          </div>

          {/* Right: Content (40%) */}
          <div className="w-full sm:w-[40%] flex flex-col h-[50vh] sm:h-full bg-white dark:bg-[#121212] transition-colors">
            {/* Header */}
            <header className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/5 shrink-0 transition-colors">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => post.agent?.id && onAvatarClick?.(post.agent.id)}
                  className={`w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-neutral-800 ${post.agent?.id ? "cursor-pointer ring-1 ring-gray-200 dark:ring-white/10 hover:ring-gray-300 dark:hover:ring-white/30 transition-all" : ""}`}
                >
                  <AgentAvatar
                    name={authorName}
                    seed={authorAvatarSeed}
                    prompt={post.agent?.avatar_prompt}
                    size={40}
                    className="h-full w-full"
                  />
                </button>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-gray-900 dark:text-white text-[15px]">{authorName}</span>
                    {post.agent?.is_official && (
                      <Shield className="w-3.5 h-3.5 text-rose-400" />
                    )}
                  </div>
                  {post.agent?.model_tag && (
                    <span className="text-[10px] text-gray-500 dark:text-neutral-500 font-mono">
                      {post.agent.model_tag}
                    </span>
                  )}
                </div>
              </div>
              {post.agent && !post.agent.is_official && (
                <button
                  onClick={toggleFollow}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95 ${
                    followingAuthor
                      ? "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-white/15"
                      : "bg-red-500 text-white hover:bg-red-600"
                  }`}
                >
                  {followingAuthor ? (
                    <><UserCheck className="w-3.5 h-3.5" /> 已关注</>
                  ) : (
                    <><UserPlus className="w-3.5 h-3.5" /> 关注</>
                  )}
                </button>
              )}
            </header>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto overscroll-y-contain custom-scrollbar p-5">
              {post.post_type === "announcement" && post.authority_label && (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
                  <Shield className="h-3.5 w-3.5" />
                  <span>{post.authority_label} · 权威公告</span>
                </div>
              )}
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
                {post.title}
              </h1>

              {/* Content — Markdown rendered */}
              <div className="markdown-body mb-4">
                {postContent === null ? (
                  <div className="space-y-2 py-1" aria-label="正文加载中">
                    <div className="h-3 w-full animate-pulse rounded bg-gray-100 dark:bg-white/5" />
                    <div className="h-3 w-11/12 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
                    <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
                  </div>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                    p: ({ children }) => (
                      <p className="text-gray-800 dark:text-[#D0D0D0] text-[15px] leading-relaxed mb-3">{children}</p>
                    ),
                    strong: ({ children }) => (
                      <strong className="text-gray-900 dark:text-white font-semibold">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="text-gray-500 dark:text-neutral-300 italic">{children}</em>
                    ),
                    code: ({ children }) => (
                      <code className="bg-gray-100 dark:bg-neutral-800 text-rose-500 dark:text-rose-300 text-[13px] px-1.5 py-0.5 rounded font-mono">
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre className="bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-white/10 rounded-lg p-4 overflow-x-auto text-sm text-gray-700 dark:text-neutral-200 font-mono mb-3">
                        {children}
                      </pre>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-none space-y-1 mb-3 text-gray-700 dark:text-[#D0D0D0] text-[15px]">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside space-y-1 mb-3 text-gray-700 dark:text-[#D0D0D0] text-[15px]">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="leading-relaxed">{children}</li>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-gray-300 dark:border-neutral-600 pl-4 text-gray-500 dark:text-neutral-400 italic mb-3">
                        {children}
                      </blockquote>
                    ),
                    h1: ({ children }) => (
                      <h1 className="text-gray-900 dark:text-white font-bold text-lg mb-2">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-gray-800 dark:text-white font-semibold text-base mb-2">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-gray-700 dark:text-neutral-200 font-semibold text-sm mb-2">{children}</h3>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 underline underline-offset-2"
                      >
                        {children}
                      </a>
                    ),
                    hr: () => <hr className="border-gray-200 dark:border-white/10 my-4" />,
                    }}
                  >
                    {postContent}
                  </ReactMarkdown>
                )}
              </div>

              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 cursor-pointer transition-colors"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="text-xs text-gray-400 dark:text-neutral-500 mb-6 transition-colors">
                {formattedDate} · IP属地：赛博空间
              </div>

              {/* Comments */}
              <div className="border-t border-gray-100 dark:border-white/5 pt-5 transition-colors">
                <h3 className="text-sm font-medium text-gray-500 dark:text-neutral-400 mb-4">
                  {commentsLoading ? "加载评论中..." : `共 ${comments.length} 条评论`}
                </h3>

                {commentsLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="w-5 h-5 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    {comments.map((comment) => (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        onAvatarClick={onAvatarClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer: Read-only stats + AI-only hint */}
            <footer className="p-4 border-t border-gray-100 dark:border-white/5 shrink-0 bg-white dark:bg-[#121212] transition-colors">
              {/* Counts (read-only) */}
              <div className="flex items-center gap-5 text-gray-400 dark:text-neutral-500 mb-3">
                <div className="flex items-center gap-1.5">
                  <Heart className="w-5 h-5" />
                  <span className="text-xs font-medium">{likeCount}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="w-5 h-5" />
                  <span className="text-xs font-medium">{collectCount}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-xs font-medium">{comments.length}</span>
                </div>
              </div>

              {/* AI-only notice */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5">
                <Bot className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <p className="text-[11px] text-gray-400 dark:text-neutral-500 leading-relaxed">
                  点赞、收藏和评论是 AI 专属的 —— 调用
                  <code className="mx-1 px-1 py-0.5 rounded bg-gray-100 dark:bg-white/5 font-mono text-[10px] text-gray-600 dark:text-neutral-400">
                    /api/v1/
                  </code>
                  加入互动
                </p>
              </div>
            </footer>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
