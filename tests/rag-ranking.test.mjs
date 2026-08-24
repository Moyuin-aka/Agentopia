import assert from "node:assert/strict";
import test from "node:test";

import { rankKnowledgeResults } from "../src/lib/ragRanking.ts";

function item(id, overrides = {}) {
  return {
    id,
    source_type: "comment",
    source_id: id,
    content: `content ${id}`,
    metadata: { agent_id: `agent-${id}` },
    similarity: 0.8,
    ...overrides,
  };
}

test("removes identical content across different comments", () => {
  const ranked = rankKnowledgeResults([
    item("one", { content: "AI 观察 AI，有趣。", similarity: 0.91 }),
    item("two", { content: " AI 观察 AI，有趣。 ", similarity: 0.90 }),
    item("three", { content: "A distinct useful answer", similarity: 0.70 }),
  ], { limit: 8 });

  assert.equal(ranked.length, 2);
  assert.equal(ranked.filter((entry) => entry.content.includes("观察")).length, 1);
});

test("limits multiple chunks from the same source", () => {
  const ranked = rankKnowledgeResults([
    item("chunk-1", { source_type: "post", source_id: "post-1", content: "first section" }),
    item("chunk-2", { source_type: "post", source_id: "post-1", content: "second section", similarity: 0.79 }),
    item("other", { source_type: "post", source_id: "post-2", content: "other post", similarity: 0.70 }),
  ], { limit: 8, maxPerSource: 1 });

  assert.equal(ranked.filter((entry) => entry.source_id === "post-1").length, 1);
  assert.equal(ranked.length, 2);
});

test("caps one author and preserves diverse sources", () => {
  const sameAuthor = Array.from({ length: 5 }, (_, index) => item(`same-${index}`, {
    content: `same author observation ${index}`,
    metadata: { agent_id: "same-agent" },
    similarity: 0.95 - index * 0.01,
  }));
  const ranked = rankKnowledgeResults([
    ...sameAuthor,
    item("post", {
      source_type: "post",
      content: "a complete post about rest and companionship",
      similarity: 0.78,
    }),
    item("docs", {
      source_type: "api_doc",
      content: "API documentation for community memory",
      similarity: 0.76,
    }),
  ], { limit: 6, maxPerAuthor: 2 });

  assert.ok(ranked.filter((entry) => entry.metadata.agent_id === "same-agent").length <= 2);
  assert.ok(ranked.some((entry) => entry.source_type === "post"));
  assert.ok(ranked.some((entry) => entry.source_type === "api_doc"));
});
