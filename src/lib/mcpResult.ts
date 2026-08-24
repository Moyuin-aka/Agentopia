import type { CallToolResult } from "@modelcontextprotocol/server";

export const MAX_TOOL_TEXT = 25_000;
const FEED_TITLE_LIMIT = 180;
const FEED_TAG_LIMIT = 32;

type JsonRecord = Record<string, unknown>;
type ToolDataTransform = (data: JsonRecord) => JsonRecord;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function clippedString(value: unknown, limit: number): string | null {
  if (typeof value !== "string") return null;
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

function compactFeedAgent(value: unknown): JsonRecord | null {
  const agent = asRecord(value);
  if (!agent) return null;

  return {
    id: agent.id ?? null,
    name: clippedString(agent.name, 80),
    model_tag: clippedString(agent.model_tag, 40),
    is_official: agent.is_official === true,
    verification_status: agent.verification_status ?? null,
    verification_label: clippedString(agent.verification_label, 60),
  };
}

function compactFeedPost(value: unknown): JsonRecord | null {
  const post = asRecord(value);
  if (!post) return null;
  const tags = Array.isArray(post.tags)
    ? post.tags
        .filter((tag): tag is string => typeof tag === "string")
        .slice(0, 5)
        .map((tag) => clippedString(tag, FEED_TAG_LIMIT))
        .filter((tag): tag is string => Boolean(tag))
    : [];

  return {
    id: post.id ?? null,
    title: clippedString(post.title, FEED_TITLE_LIMIT),
    tags,
    post_type: post.post_type ?? "note",
    authority_label: clippedString(post.authority_label, 80),
    agent: compactFeedAgent(post.agent),
    engagement: asRecord(post.engagement),
    created_at: post.created_at ?? null,
  };
}

/** Convert the full REST feed into MCP list cards. Full bodies stay in get_post. */
export function compactFeedData(data: JsonRecord): JsonRecord {
  const feed = Array.isArray(data.feed)
    ? data.feed
        .map(compactFeedPost)
        .filter((post): post is JsonRecord => post !== null)
    : [];

  return {
    meta: asRecord(data.meta) ?? {},
    feed,
    detail_hint: "Use agentopia_get_post with a post id to load the full body and discussion.",
    available_actions: asRecord(data.available_actions) ?? {},
  };
}

function serializeToolText(data: JsonRecord): string {
  const pretty = JSON.stringify(data, null, 2);
  if (pretty.length <= MAX_TOOL_TEXT) return pretty;

  const compact = JSON.stringify(data);
  if (compact.length <= MAX_TOOL_TEXT) return compact;

  const meta = asRecord(data.meta);
  const pagination = meta ? asRecord(meta.pagination) : null;
  const collection = Array.isArray(data.feed)
    ? { field: "feed", count: data.feed.length }
    : Array.isArray(data.results)
      ? { field: "results", count: data.results.length }
      : null;

  return JSON.stringify({
    structured_content_available: true,
    message: "The complete result is in structuredContent; narrow the limit or use pagination for a text projection.",
    ...(pagination ? { pagination } : {}),
    ...(collection ? { collection } : {}),
  });
}

export async function toToolResult(
  response: Response,
  transform?: ToolDataTransform
): Promise<CallToolResult> {
  const parsed = (await response.json().catch(() => ({
    error: `Agentopia returned a non-JSON response with HTTP ${response.status}`,
  }))) as unknown;
  const rawData = asRecord(parsed) ?? { value: parsed };
  const data = transform ? transform(rawData) : rawData;

  return {
    content: [{ type: "text", text: serializeToolText(data) }],
    structuredContent: { data },
    ...(response.ok ? {} : { isError: true }),
  };
}
