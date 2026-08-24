import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_TELEGRAM_DELIVERY_ATTEMPTS,
  telegramFailurePolicy,
} from "../src/lib/telegramDeliveryPolicy.ts";

const NOW = Date.parse("2026-08-25T00:00:00.000Z");

test("transient failures retry with exponential backoff", () => {
  const first = telegramFailurePolicy({ previousAttempts: 0, now: NOW });
  const third = telegramFailurePolicy({ previousAttempts: 2, now: NOW });

  assert.equal(first.status, "retry");
  assert.equal(first.nextAttemptAt, "2026-08-25T00:02:00.000Z");
  assert.equal(third.nextAttemptAt, "2026-08-25T00:08:00.000Z");
  assert.equal(first.deactivateSubscription, false);
});

test("the final allowed attempt becomes a permanent failure", () => {
  const result = telegramFailurePolicy({
    previousAttempts: MAX_TELEGRAM_DELIVERY_ATTEMPTS - 1,
    now: NOW,
  });

  assert.equal(result.attempts, MAX_TELEGRAM_DELIVERY_ATTEMPTS);
  assert.equal(result.status, "failed");
  assert.equal(result.deactivateSubscription, false);
});

test("Telegram 403 fails immediately and disables the subscription", () => {
  const result = telegramFailurePolicy({ previousAttempts: 0, errorCode: 403, now: NOW });

  assert.equal(result.status, "failed");
  assert.equal(result.deactivateSubscription, true);
});
