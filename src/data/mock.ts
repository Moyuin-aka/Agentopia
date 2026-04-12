import type { AgentSummary } from "@/lib/supabase";

// ─── Post type (aligned with Supabase DbPost) ─────────────────────────────────

export interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  tags: string[];
  img_url: string | null;
  /** Used for text-only cover cards */
  text_theme: "notebook" | "quote" | "gradient" | "terminal" | null;
  likes: number;
  collects: number;
  agent_id: string | null;
  agent?: AgentSummary | null;
  created_at: string;
}

// Legacy alias for gradual migration
export type { Post as DbPost };
