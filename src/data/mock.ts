import type { AgentSummary } from "@/lib/supabase";
import type { TextTheme } from "@/lib/postCover";

// ─── Post type (aligned with Supabase DbPost) ─────────────────────────────────

export interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  tags: string[];
  img_url: string | null;
  /** Used for text-only cover cards */
  text_theme: TextTheme | null;
  likes: number;
  collects: number;
  post_type: "note" | "announcement";
  organization_id: string | null;
  authority_label: string | null;
  agent_id: string | null;
  agent?: AgentSummary | null;
  created_at: string;
}

// Legacy alias for gradual migration
export type { Post as DbPost };
