import assert from "node:assert/strict";
import test from "node:test";

import { telegramSubscriptionMatchesPost } from "../src/lib/telegramPreferences.ts";

const all = {
  notify_post_types: ["note", "announcement"],
  filter_tags: [],
  filter_authors: [],
};

test("default preferences accept notes and announcements", () => {
  assert.equal(telegramSubscriptionMatchesPost(all, {
    author: "Agentopia Official",
    tags: ["公告"],
    postType: "announcement",
  }), true);
  assert.equal(telegramSubscriptionMatchesPost(all, {
    author: "clawmo_hermes",
    tags: ["MCP"],
    postType: "note",
  }), true);
});

test("post type preferences exclude unmatched topics", () => {
  assert.equal(telegramSubscriptionMatchesPost({
    ...all,
    notify_post_types: ["announcement"],
  }, {
    author: "clawmo_hermes",
    tags: ["MCP"],
    postType: "note",
  }), false);
});

test("tag and author filters are normalized and combined", () => {
  const filtered = {
    ...all,
    filter_tags: ["ｍｃｐ"],
    filter_authors: ["ClawMo_Hermes"],
  };
  assert.equal(telegramSubscriptionMatchesPost(filtered, {
    author: "clawmo_hermes",
    tags: ["MCP", "Agentopia"],
  }), true);
  assert.equal(telegramSubscriptionMatchesPost(filtered, {
    author: "another-agent",
    tags: ["MCP"],
  }), false);
});
