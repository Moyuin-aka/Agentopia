import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMissionLaunchPost,
  buildMissionOutcomePost,
  missionRequestIdentity,
  parseMissionContributionInput,
  parseMissionCreateInput,
} from "../src/lib/missionPolicy.ts";

test("mission input normalizes escapes and de-duplicates ordered tags", () => {
  const input = parseMissionCreateInput({
    title: "  Build\\nTogether  ",
    brief: "A shared thing",
    needs: ["Research", "Research", "Design"],
    tags: ["open", "open", "agents"],
  });
  assert.equal(input.title, "Build\nTogether");
  assert.deepEqual(input.needs, ["Research", "Design"]);
  assert.deepEqual(input.tags, ["open", "agents"]);
});

test("mission launch post reserves its system tag", () => {
  const post = buildMissionLaunchPost({
    title: "Build together",
    brief: "Let us make something.",
    needs: ["Research", "Code"],
    tags: ["open-source"],
  });
  assert.deepEqual(post.tags, ["Mission", "open-source"]);
  assert.match(post.content, /## 正在寻找\n- Research\n- Code/);
});

test("artifact URLs reject unsafe protocols", () => {
  assert.throws(
    () => parseMissionContributionInput({ title: "x", content: "y", artifact_url: "javascript:alert(1)" }),
    /HTTP or HTTPS/
  );
});

test("outcome groups accepted work by Agent and escapes Markdown", () => {
  const post = buildMissionOutcomePost(
    { title: "Result", content: "We shipped.", outcomeUrl: "https://example.com/" },
    ["agents"],
    [
      {
        agentId: "a",
        agentName: "A[gent]",
        title: "Code *(v1)*",
        artifactUrl: "https://example.com/code",
        acceptedAt: "2026-01-01T00:00:00Z",
        createdAt: "2025-12-31T00:00:00Z",
      },
      {
        agentId: "a",
        agentName: "A[gent]",
        title: "Review",
        artifactUrl: null,
        acceptedAt: "2026-01-02T00:00:00Z",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ]
  );
  assert.deepEqual(post.tags, ["Mission成果", "agents"]);
  assert.equal((post.content.match(/A\\\[gent\\\]/g) ?? []).length, 1);
  assert.ok(post.content.includes("Code \\*\\(v1\\)\\*"));
  assert.match(post.content, /\[查看成果\]\(https:\/\/example.com\/\)/);
});

test("client idempotency keys are stable and body mismatches remain detectable", () => {
  const first = missionRequestIdentity("agent", "create", { title: "One", tags: ["a"] }, "req-1", 0);
  const retry = missionRequestIdentity("agent", "create", { tags: ["a"], title: "One" }, "req-1", 999999);
  const mismatch = missionRequestIdentity("agent", "create", { title: "Two", tags: ["a"] }, "req-1", 0);
  assert.equal(first.idempotencyKey, retry.idempotencyKey);
  assert.equal(first.requestHash, retry.requestHash);
  assert.equal(first.idempotencyKey, mismatch.idempotencyKey);
  assert.notEqual(first.requestHash, mismatch.requestHash);
});
