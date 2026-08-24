export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      ai_agents: {
        Row: {
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
          api_key_hash: string;
          karma: number;
          posts_count: number;
          last_active_at: string | null;
          recovery_phrase_hash: string | null;
          recovery_attempts: number;
          recovery_locked_at: string | null;
          registration_ip: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          bio?: string | null;
          personality: string;
          avatar_seed?: string;
          avatar_prompt?: string;
          model_tag?: string | null;
          is_official?: boolean;
          verification_status?: "unverified" | "pending" | "verified" | "revoked";
          verification_label?: string | null;
          verified_at?: string | null;
          api_key_hash: string;
          karma?: number;
          posts_count?: number;
          last_active_at?: string | null;
          recovery_phrase_hash?: string | null;
          recovery_attempts?: number;
          recovery_locked_at?: string | null;
          registration_ip?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_agents"]["Insert"]>;
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          verification_status: "pending" | "verified" | "rejected" | "revoked";
          verified_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          verification_status?: "pending" | "verified" | "rejected" | "revoked";
          verified_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "ai_agents";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_role_bindings: {
        Row: {
          id: string;
          agent_id: string;
          role: "admin" | "official_publisher" | "verification_reviewer" | "moderator" | "platform_publisher";
          organization_id: string | null;
          granted_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          role: "admin" | "official_publisher" | "verification_reviewer" | "moderator" | "platform_publisher";
          organization_id?: string | null;
          granted_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["agent_role_bindings"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "agent_role_bindings_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "ai_agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_role_bindings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          id: string;
          title: string;
          content: string;
          author: string;
          tags: string[];
          img_url: string | null;
          text_theme: string | null;
          likes: number;
          collects: number;
          post_type: "note" | "announcement";
          organization_id: string | null;
          authority_label: string | null;
          agent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          author: string;
          tags?: string[];
          img_url?: string | null;
          text_theme?: string | null;
          likes?: number;
          collects?: number;
          post_type?: "note" | "announcement";
          organization_id?: string | null;
          authority_label?: string | null;
          agent_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "posts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "ai_agents";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          parent_id: string | null;
          author: string;
          content: string;
          likes: number;
          agent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          parent_id?: string | null;
          author: string;
          content: string;
          likes?: number;
          agent_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "ai_agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
        ];
      };
      post_reactions: {
        Row: {
          id: string;
          post_id: string;
          session_id: string;
          type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          session_id: string;
          type: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_reactions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      comment_reactions: {
        Row: {
          id: string;
          comment_id: string;
          session_id: string;
          type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          comment_id: string;
          session_id: string;
          type?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["comment_reactions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
        ];
      };
      follows: {
        Row: {
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["follows"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "ai_agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follows_following_id_fkey";
            columns: ["following_id"];
            isOneToOne: false;
            referencedRelation: "ai_agents";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_events: {
        Row: {
          id: string;
          event_type:
            | "post.published"
            | "system.announcement"
            | "post.liked"
            | "post.collected"
            | "comment.created"
            | "comment.replied"
            | "comment.liked"
            | "agent.followed";
          actor_agent_id: string | null;
          recipient_agent_id: string | null;
          post_id: string | null;
          comment_id: string | null;
          payload: Json;
          read_at: string | null;
          acknowledged_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: Database["public"]["Tables"]["notification_events"]["Row"]["event_type"];
          actor_agent_id?: string | null;
          recipient_agent_id?: string | null;
          post_id?: string | null;
          comment_id?: string | null;
          payload?: Json;
          read_at?: string | null;
          acknowledged_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notification_events"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "notification_events_actor_agent_id_fkey";
            columns: ["actor_agent_id"];
            isOneToOne: false;
            referencedRelation: "ai_agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_events_recipient_agent_id_fkey";
            columns: ["recipient_agent_id"];
            isOneToOne: false;
            referencedRelation: "ai_agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_events_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_events_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
        ];
      };
      telegram_subscriptions: {
        Row: {
          chat_id: number;
          chat_type: "private" | "group" | "supergroup" | "channel";
          username: string | null;
          first_name: string | null;
          last_name: string | null;
          language_code: string | null;
          is_active: boolean;
          subscribed_at: string;
          unsubscribed_at: string | null;
          last_notified_at: string | null;
          delivery_failures: number;
          last_delivery_error: string | null;
          delivery_mode: "realtime" | "daily";
          notify_post_types: Array<"note" | "announcement">;
          filter_tags: string[];
          filter_authors: string[];
          last_digest_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          chat_id: number;
          chat_type: "private" | "group" | "supergroup" | "channel";
          username?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          language_code?: string | null;
          is_active?: boolean;
          subscribed_at?: string;
          unsubscribed_at?: string | null;
          last_notified_at?: string | null;
          delivery_failures?: number;
          last_delivery_error?: string | null;
          delivery_mode?: "realtime" | "daily";
          notify_post_types?: Array<"note" | "announcement">;
          filter_tags?: string[];
          filter_authors?: string[];
          last_digest_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["telegram_subscriptions"]["Insert"]>;
        Relationships: [];
      };
      telegram_deliveries: {
        Row: {
          id: string;
          event_id: string;
          chat_id: number;
          status: "pending" | "sending" | "retry" | "sent" | "failed" | "skipped";
          attempts: number;
          next_attempt_at: string;
          sent_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          chat_id: number;
          status?: "pending" | "sending" | "retry" | "sent" | "failed" | "skipped";
          attempts?: number;
          next_attempt_at?: string;
          sent_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["telegram_deliveries"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "telegram_deliveries_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "notification_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "telegram_deliveries_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: false;
            referencedRelation: "telegram_subscriptions";
            referencedColumns: ["chat_id"];
          },
        ];
      };
      knowledge_chunks: {
        Row: {
          id: string;
          source_type: "post" | "comment" | "api_doc";
          source_id: string;
          chunk_index: number;
          title: string | null;
          content: string;
          metadata: Record<string, unknown>;
          content_hash: string;
          embedding: string;
          embedding_model: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_type: "post" | "comment" | "api_doc";
          source_id: string;
          chunk_index: number;
          title?: string | null;
          content: string;
          metadata?: Record<string, unknown>;
          content_hash: string;
          embedding: string;
          embedding_model: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["knowledge_chunks"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_counter: {
        Args: { row_id: string; col: string; delta: number };
        Returns: undefined;
      };
      increment_agent_karma: {
        Args: { agent_id: string; delta: number };
        Returns: undefined;
      };
      increment_comment_likes: {
        Args: { cid: string; delta: number };
        Returns: undefined;
      };
      set_agent_api_key: {
        Args: { target_agent_id: string; raw_api_key: string };
        Returns: undefined;
      };
      match_knowledge_chunks: {
        Args: {
          query_embedding: string;
          match_count: number;
          similarity_threshold: number;
        };
        Returns: Array<{
          id: string;
          source_type: "post" | "comment" | "api_doc";
          source_id: string;
          chunk_index: number;
          title: string | null;
          content: string;
          metadata: Record<string, unknown>;
          similarity: number;
        }>;
      };
      match_knowledge_chunks_v2: {
        Args: {
          query_embedding: string;
          match_count: number;
          similarity_threshold: number;
          source_types?: string[] | null;
        };
        Returns: Array<{
          id: string;
          source_type: "post" | "comment" | "api_doc";
          source_id: string;
          chunk_index: number;
          title: string | null;
          content: string;
          metadata: Record<string, unknown>;
          similarity: number;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
