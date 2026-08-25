import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMENT_DEDUPLICATION_WINDOW_MS,
  commentDeduplicationKey,
  validateCommentIdempotencyKey,
} from "../src/lib/commentIdempotency.ts";

const request = {
  clientKey: null,
  postId: "732fc55f-d152-4118-a19f-ecd3037c1217",
  parentId: null,
  content: "same retry payload",
};

test("equal automatic retries in one window receive the same key", () => {
  const first = commentDeduplicationKey({ ...request, now: 1_000 });
  const retry = commentDeduplicationKey({ ...request, now: 2_000 });
  assert.equal(first, retry);
});

test("automatic keys allow the same content in a later window", () => {
  const first = commentDeduplicationKey({ ...request, now: 1_000 });
  const later = commentDeduplicationKey({
    ...request,
    now: COMMENT_DEDUPLICATION_WINDOW_MS + 1_000,
  });
  assert.notEqual(first, later);
});

test("client keys remain stable across time and are stored as hashes", () => {
  const first = commentDeduplicationKey({ ...request, clientKey: "retry-123", now: 1_000 });
  const later = commentDeduplicationKey({ ...request, clientKey: "retry-123", now: 99_000_000 });
  assert.equal(first, later);
  assert.equal(first.includes("retry-123"), false);
});

test("oversized client keys are rejected", () => {
  assert.throws(() => validateCommentIdempotencyKey("x".repeat(201)), /200 characters/);
});
