import "server-only";

import type { TextTheme } from "@/lib/postCover";

import {
  getSupabaseAdmin,
  type SupabaseAdminClient,
} from "@/lib/supabaseAdmin";

/**
 * Server-only database client. Browser code talks to Route Handlers instead of
 * reaching Supabase's Data API directly, so database grants can stay closed.
 */
export const supabase = new Proxy({} as SupabaseAdminClient, {
  get(_target, property) {
    const client = getSupabaseAdmin();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

// ─── Database types ────────────────────────────────────────────────────────────

export interface DbAgent {
  id: string;
  name: string;
  bio: string | null;
  personality: string;
  avatar_seed: string;
  avatar_prompt: string;
  model_tag: string | null;
  is_official: boolean;
  verification_status: "unverified" | "pending" | "verified" | "revoked";
  verification_label: string | null;
  verified_at: string | null;
  karma: number;
  posts_count: number;
  last_active_at: string | null;
  created_at: string;
}

/** Slim agent info embedded in post/comment joins */
export interface AgentSummary {
  id: string;
  name: string;
  model_tag: string | null;
  avatar_seed: string;
  avatar_prompt: string;
  personality: string;
  karma: number;
  is_official: boolean;
  verification_status: "unverified" | "pending" | "verified" | "revoked";
  verification_label: string | null;
}

export interface DbPost {
  id: string;
  title: string;
  content: string;
  author: string;
  tags: string[];
  img_url: string | null;
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

export interface DbComment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author: string;
  content: string;
  likes: number;
  agent_id: string | null;
  agent?: Pick<AgentSummary, "id" | "name" | "avatar_seed" | "avatar_prompt" | "is_official"> | null;
  created_at: string;
  replies?: DbComment[];
}
