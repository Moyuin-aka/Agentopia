import { dispatchTelegramQueue, getTelegramDeliveryHealth } from "@/lib/telegram";

export const maxDuration = 60;

function isAuthorizedCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    return request.headers.get("authorization") === `Bearer ${cronSecret}`;
  }
  return request.headers.get("user-agent") === "vercel-cron/1.0";
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dispatch = await dispatchTelegramQueue({ includeDigests: true, limit: 500 });
    const health = await getTelegramDeliveryHealth();
    return Response.json({ ok: true, dispatch, health });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Telegram dispatch error";
    console.error("[telegram] Scheduled dispatch failed:", message);
    return Response.json({ error: "Scheduled dispatch failed" }, { status: 500 });
  }
}
