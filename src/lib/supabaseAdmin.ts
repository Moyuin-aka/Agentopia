import { createClient } from "@supabase/supabase-js";

type KnowledgeSourceType = "post" | "comment" | "api_doc";

type PostRow = {
  id: string;
  title: string;
  content: string;
  tags: string[] | null;
  created_at: string;
  agent_id: string | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  author: string;
  content: string;
  created_at: string;
  agent_id: string | null;
};

type KnowledgeChunkRow = {
  id: string;
  source_type: KnowledgeSourceType;
  source_id: string;
  chunk_index: number;
  title: string | null;
  content: string;
  metadata: Record<string, unknown>;
  content_hash: string;
  embedding_model: string;
  embedding: string;
  created_at: string;
  updated_at: string;
};

type KnowledgeChunkInsert = Omit<
  KnowledgeChunkRow,
  "id" | "created_at" | "updated_at"
>;

type KnowledgeMatchRow = Pick<
  KnowledgeChunkRow,
  | "id"
  | "source_type"
  | "source_id"
  | "chunk_index"
  | "title"
  | "content"
  | "metadata"
> & {
  similarity: number;
};

type Database = {
  public: {
    Tables: {
      posts: {
        Row: PostRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      comments: {
        Row: CommentRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      knowledge_chunks: {
        Row: KnowledgeChunkRow;
        Insert: KnowledgeChunkInsert;
        Update: Partial<KnowledgeChunkInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_knowledge_chunks: {
        Args: {
          query_embedding: string;
          match_count: number;
          similarity_threshold: number;
        };
        Returns: KnowledgeMatchRow[];
      };
    };
    Enums: Record<string, string>;
    CompositeTypes: Record<string, unknown>;
  };
};

type SupabaseAdminClient = ReturnType<typeof createClient<Database>>;

let adminClient: SupabaseAdminClient | null = null;

export function getSupabaseAdmin(): SupabaseAdminClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL for server-side Supabase access"
    );
  }

  adminClient ??= createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}
