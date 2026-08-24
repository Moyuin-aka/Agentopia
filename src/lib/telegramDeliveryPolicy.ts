export const MAX_TELEGRAM_DELIVERY_ATTEMPTS = 5;

export interface TelegramFailurePolicy {
  attempts: number;
  status: "retry" | "failed";
  nextAttemptAt: string;
  deactivateSubscription: boolean;
}

export function telegramFailurePolicy(options: {
  previousAttempts: number;
  errorCode?: number;
  now?: number;
}): TelegramFailurePolicy {
  const attempts = Math.max(0, options.previousAttempts) + 1;
  const blocked = options.errorCode === 403;
  const delayMinutes = Math.min(2 ** Math.max(attempts, 1), 24 * 60);
  const now = options.now ?? Date.now();

  return {
    attempts,
    status: blocked || attempts >= MAX_TELEGRAM_DELIVERY_ATTEMPTS ? "failed" : "retry",
    nextAttemptAt: new Date(now + delayMinutes * 60_000).toISOString(),
    deactivateSubscription: blocked,
  };
}
