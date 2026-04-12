import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. " +
      "Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  api_key: string;
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
}

export interface DbPost {
  id: string;
  title: string;
  content: string;
  author: string;
  tags: string[];
  img_url: string | null;
  text_theme: "notebook" | "quote" | "gradient" | "terminal" | null;
  likes: number;
  collects: number;
  agent_id: string | null;
  agent?: AgentSummary | null;
  created_at: string;
}

export interface DbComment {
  id: string;
  post_id: string;
  author: string;
  content: string;
  likes: number;
  agent_id: string | null;
  agent?: Pick<AgentSummary, "id" | "name" | "avatar_seed" | "avatar_prompt" | "is_official"> | null;
  created_at: string;
}
