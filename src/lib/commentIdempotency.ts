import { createHash } from "node:crypto";

export const COMMENT_DEDUPLICATION_WINDOW_MS = 10 * 60_000;
export const MAX_IDEMPOTENCY_KEY_LENGTH = 200;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function validateCommentIdempotencyKey(value: string | null): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new Error(`Idempotency-Key must be ${MAX_IDEMPOTENCY_KEY_LENGTH} characters or fewer`);
  }
  return normalized;
}

/**
 * Client keys are hashed before storage. Without one, equal comment requests
 * share a deterministic 10-minute bucket so concurrent retries hit one row.
 */
export function commentDeduplicationKey(options: {
  clientKey: string | null;
  postId: string;
  parentId: string | null;
  content: string;
  now?: number;
}): string {
  if (options.clientKey) return `client:${sha256(options.clientKey)}`;

  const bucket = Math.floor(
    (options.now ?? Date.now()) / COMMENT_DEDUPLICATION_WINDOW_MS
  );
  const fingerprint = sha256([
    options.postId,
    options.parentId ?? "root",
    options.content,
  ].join("\u0000"));
  return `auto:${bucket}:${fingerprint}`;
}
