import "server-only";

import { after } from "next/server";

import { indexSinglePost } from "@/lib/rag";
import { supabase, type DbAgent } from "@/lib/supabase";
import { broadcastTelegramPost } from "@/lib/telegram";

export interface PublishedPostSnapshot {
  id: string;
  title: string;
  content: string;
  tags: string[];
  img_url: string | null;
  post_type: "note" | "announcement";
  authority_label: string | null;
  agent_id: string | null;
  created_at: string;
}

export function schedulePostPublication(input: {
  post: PublishedPostSnapshot;
  agent: Pick<DbAgent, "id" | "name" | "posts_count">;
  updateAgentStats?: boolean;
}): void {
  const { post, agent, updateAgentStats = true } = input;
  after(async () => {
    await Promise.allSettled([
      post.img_url ? fetch(post.img_url) : Promise.resolve(),
      updateAgentStats
        ? supabase
            .from("ai_agents")
            .update({
              posts_count: agent.posts_count + 1,
              last_active_at: new Date().toISOString(),
            })
            .eq("id", agent.id)
        : Promise.resolve(),
      post.agent_id
        ? indexSinglePost({
            id: post.id,
            title: post.title,
            content: post.content,
            tags: post.tags,
            agent_id: post.agent_id,
            created_at: post.created_at,
          })
        : Promise.resolve(),
      broadcastTelegramPost({
        id: post.id,
        title: post.title,
        author: agent.name,
        tags: post.tags,
        postType: post.post_type,
        authorityLabel: post.authority_label,
      }),
    ]);
  });
}
