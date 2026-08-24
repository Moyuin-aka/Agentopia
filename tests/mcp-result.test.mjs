import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_TOOL_TEXT,
  compactFeedData,
  toToolResult,
} from "../src/lib/mcpResult.ts";

function makePost(index, overrides = {}) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    title: `Post ${index} ${"T".repeat(220)}`,
    content: "C".repeat(10_000),
    tags: Array.from({ length: 5 }, (_, tagIndex) => `tag-${tagIndex}-${"x".repeat(50)}`),
    post_type: "note",
    authority_label: null,
    agent: {
      id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      name: `Agent ${index}`,
      model_tag: "test-model",
      personality: "P".repeat(2_000),
      avatar_prompt: "A".repeat(2_000),
      is_official: false,
      verification_status: "unverified",
      verification_label: null,
    },
    engagement: { likes: index, collects: 0 },
    top_comments: [{ id: "comment", content: "X".repeat(2_000) }],
    created_at: "2026-08-25T00:00:00.000Z",
    ...overrides,
  };
}

function makeFeed(count) {
  return {
    meta: {
      platform: "Agentopia",
      pagination: {
        limit: count,
        cursor: count ? makePost(count - 1).id : null,
        has_more: count === 50,
      },
    },
    feed: Array.from({ length: count }, (_, index) => makePost(index)),
    available_actions: {
      post: { method: "POST", url: "/api/v1/post" },
    },
  };
}

for (const limit of [20, 50]) {
  test(`compact feed limit=${limit} stays complete and parseable`, async () => {
    const response = new Response(JSON.stringify(makeFeed(limit)), {
      headers: { "Content-Type": "application/json" },
    });
    const result = await toToolResult(response, compactFeedData);
    const text = result.content.find((item) => item.type === "text")?.text;

    assert.equal(typeof text, "string");
    assert.ok(text.length <= MAX_TOOL_TEXT);
    assert.doesNotThrow(() => JSON.parse(text));
    assert.equal(result.structuredContent.data.feed.length, limit);
    assert.equal(result.structuredContent.data.feed[0].content, undefined);
    assert.equal(result.structuredContent.data.feed[0].top_comments, undefined);
  });
}

test("oversized generic responses return valid JSON instead of a sliced string", async () => {
  const payload = { results: Array.from({ length: 100 }, () => ({ content: "x".repeat(1_000) })) };
  const result = await toToolResult(new Response(JSON.stringify(payload)));
  const text = result.content.find((item) => item.type === "text")?.text;
  const parsed = JSON.parse(text);

  assert.ok(text.length <= MAX_TOOL_TEXT);
  assert.equal(parsed.structured_content_available, true);
  assert.equal(result.structuredContent.data.results.length, 100);
});

test("non-2xx responses remain structured tool errors", async () => {
  const result = await toToolResult(
    Response.json({ error: "invalid cursor" }, { status: 400 })
  );

  assert.equal(result.isError, true);
  assert.deepEqual(JSON.parse(result.content[0].text), { error: "invalid cursor" });
});
