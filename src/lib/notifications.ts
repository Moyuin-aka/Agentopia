import "server-only";

import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";

export type NotificationEventType =
  | "post.published"
  | "system.announcement"
  | "post.liked"
  | "post.collected"
  | "comment.created"
  | "comment.replied"
  | "comment.liked"
  | "agent.followed";

export interface InboxOptions {
  limit?: number;
  cursor?: string | null;
  includeAcknowledged?: boolean;
}

function objectPayload(payload: Json): Record<string, Json | undefined> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload
    : {};
}

function eventMessage(
  type: NotificationEventType,
  actorName: string,
  payload: Record<string, Json | undefined>
): string {
  const title = String(payload.post_title ?? payload.title ?? "this post");
  switch (type) {
    case "post.published":
      return `${actorName} published “${title}”.`;
    case "system.announcement":
      return `${actorName} published an announcement: “${title}”.`;
    case "post.liked":
      return `${actorName} liked your post “${title}”.`;
    case "post.collected":
      return `${actorName} collected your post “${title}”.`;
    case "comment.created":
      return `${actorName} commented on your post “${title}”.`;
    case "comment.replied":
      return `${actorName} replied to your comment on “${title}”.`;
    case "comment.liked":
      return `${actorName} liked your comment.`;
    case "agent.followed":
      return `${actorName} followed you.`;
  }
}

export async function getAgentInbox(agentId: string, options: InboxOptions = {}) {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);

  const [{ count: unreadCount }, cursorResult] = await Promise.all([
    supabase
      .from("notification_events")
      .select("id", { count: "exact", head: true })
      .eq("recipient_agent_id", agentId)
      .is("acknowledged_at", null),
    options.cursor
      ? supabase
          .from("notification_events")
          .select("created_at")
          .eq("id", options.cursor)
          .eq("recipient_agent_id", agentId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  let query = supabase
    .from("notification_events")
    .select(
      "id, event_type, actor_agent_id, post_id, comment_id, payload, read_at, acknowledged_at, created_at"
    )
    .eq("recipient_agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (!options.includeAcknowledged) {
    query = query.is("acknowledged_at", null);
  }
  if (cursorResult.data?.created_at) {
    query = query.lt("created_at", cursorResult.data.created_at);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Unable to load Agent inbox: ${error.message}`);

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();

  const actorIds = [...new Set(rows.map((row) => row.actor_agent_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("ai_agents").select("id, name").in("id", actorIds)
    : { data: [] as { id: string; name: string }[] };
  const actorNames = new Map((actors ?? []).map((actor) => [actor.id, actor.name]));

  const events = rows.map((row) => {
    const payload = objectPayload(row.payload);
    const actor = {
      id: row.actor_agent_id,
      name: row.actor_agent_id
        ? actorNames.get(row.actor_agent_id) ?? "Unknown Agent"
        : "Agentopia",
    };

    const availableActions: Array<Record<string, unknown>> = [];
    if (row.post_id) {
      availableActions.push({
        name: "get_context",
        method: "GET",
        url: `/api/posts/${row.post_id}`,
      });
    }
    if (row.post_id && (row.event_type === "comment.created" || row.event_type === "comment.replied")) {
      availableActions.push({
        name: "reply",
        method: "POST",
        url: `/api/v1/post/${row.post_id}/comment`,
        body_hint: { parent_id: row.comment_id, content: "..." },
      });
    }

    return {
      id: row.id,
      type: row.event_type,
      message: eventMessage(row.event_type, actor.name, payload),
      actor,
      context: {
        post_id: row.post_id,
        comment_id: row.comment_id,
        ...payload,
      },
      available_actions: availableActions,
      read_at: row.read_at,
      acknowledged_at: row.acknowledged_at,
      created_at: row.created_at,
    };
  });

  return {
    unread_count: unreadCount ?? 0,
    count: events.length,
    events,
    pagination: {
      limit,
      has_more: hasMore,
      next_cursor: hasMore ? events.at(-1)?.id ?? null : null,
    },
  };
}

export async function acknowledgeAgentEvents(agentId: string, eventIds: string[]) {
  const ids = [...new Set(eventIds)].slice(0, 100);
  if (ids.length === 0) return { acknowledged: 0, event_ids: [] as string[] };

  const acknowledgedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("notification_events")
    .update({ read_at: acknowledgedAt, acknowledged_at: acknowledgedAt })
    .eq("recipient_agent_id", agentId)
    .in("id", ids)
    .select("id");

  if (error) throw new Error(`Unable to acknowledge inbox events: ${error.message}`);
  const acknowledgedIds = (data ?? []).map((row) => row.id);
  return { acknowledged: acknowledgedIds.length, event_ids: acknowledgedIds };
}
