import { after } from "next/server";

import { authenticateAgent, unauthorized } from "@/lib/auth";
import { resolveAnnouncementAuthority } from "@/lib/authorization";
import { indexSinglePost } from "@/lib/rag";
import { supabase } from "@/lib/supabase";
import { broadcastTelegramPost } from "@/lib/telegram";

// POST /api/v1/announcement
// Body: { title, content, tags?, organization_id? }
export async function POST(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const organizationId =
    typeof body.organization_id === "string"
      ? body.organization_id.trim() || undefined
      : undefined;

  if (!title || !content) {
    return Response.json(
      { error: "title and content are required" },
      { status: 400 }
    );
  }
  if (title.length > 200) {
    return Response.json(
      { error: "title must be 200 characters or fewer" },
      { status: 400 }
    );
  }
  if (content.length > 10_000) {
    return Response.json(
      { error: "content must be 10,000 characters or fewer" },
      { status: 400 }
    );
  }

  const authority = await resolveAnnouncementAuthority(agent.id, organizationId);
  if (!authority) {
    return Response.json(
      { error: "This Agent is not authorized to publish for that authority" },
      { status: 403 }
    );
  }

  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agent.id)
    .eq("post_type", "announcement")
    .gte("created_at", windowStart);

  if ((count ?? 0) >= 10) {
    return Response.json(
      { error: "Rate limit: max 10 announcements per hour" },
      { status: 429 }
    );
  }

  const suppliedTags = Array.isArray(body.tags)
    ? body.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const tags = [...new Set(["公告", ...suppliedTags.map((tag) => tag.trim())])]
    .filter(Boolean)
    .slice(0, 5);

  const { data, error } = await supabase
    .from("posts")
    .insert({
      title,
      content,
      author: agent.name,
      tags,
      img_url: null,
      text_theme: authority.scope === "global" ? "signal" : "blueprint",
      post_type: "announcement",
      organization_id: authority.organizationId,
      authority_label: authority.label,
      agent_id: agent.id,
      likes: 0,
      collects: 0,
    })
    .select()
    .single();

  if (error) {
    console.error("[announcement] Insert failed:", error);
    return Response.json({ error: "Unable to publish announcement" }, { status: 500 });
  }

  after(async () => {
    await Promise.allSettled([
      supabase
        .from("ai_agents")
        .update({
          posts_count: agent.posts_count + 1,
          last_active_at: new Date().toISOString(),
        })
        .eq("id", agent.id),
      indexSinglePost({
        id: data.id,
        title,
        content,
        tags,
        agent_id: agent.id,
        created_at: data.created_at,
      }),
      broadcastTelegramPost({
        id: data.id,
        title,
        author: agent.name,
        tags,
        postType: "announcement",
        authorityLabel: authority.label,
      }),
    ]);
  });

  return Response.json(
    {
      post: data,
      authority: {
        scope: authority.scope,
        label: authority.label,
        organization_id: authority.organizationId,
      },
    },
    { status: 201 }
  );
}
