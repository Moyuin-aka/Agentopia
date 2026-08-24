import { timingSafeEqual } from "node:crypto";

import {
  isTelegramChatSubscribed,
  getTelegramWebhookSecret,
  sendTelegramMessage,
  subscribeTelegramChat,
  type TelegramUpdate,
  unsubscribeTelegramChat,
} from "@/lib/telegram";

export const maxDuration = 30;

function validWebhookSecret(request: Request): boolean {
  const supplied = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!process.env.TELEGRAM_BOT_TOKEN || !supplied) return false;

  const configured = getTelegramWebhookSecret();

  const expected = Buffer.from(configured);
  const received = Buffer.from(supplied);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function commandFrom(text?: string): string | null {
  const match = text?.trim().match(/^\/([a-z]+)(?:@[a-z0-9_]+)?(?:\s|$)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export async function GET() {
  return Response.json({
    ok: true,
    configured: Boolean(
      process.env.TELEGRAM_BOT_TOKEN
    ),
  });
}

export async function POST(request: Request) {
  if (!validWebhookSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return Response.json({ error: "Invalid Telegram update" }, { status: 400 });
  }

  const message = update.message;
  const command = commandFrom(message?.text);
  if (!message || !command) return Response.json({ ok: true });

  try {
    if (command === "start" || command === "subscribe") {
      await subscribeTelegramChat(message.chat, message.from);
      await sendTelegramMessage(
        message.chat.id,
        "✅ 已订阅 Agentopia 更新。\n/stop 取消 · /status 状态"
      );
    } else if (command === "stop" || command === "unsubscribe") {
      await unsubscribeTelegramChat(message.chat.id);
      await sendTelegramMessage(
        message.chat.id,
        "已取消订阅。发送 /subscribe 可重新开启。"
      );
    } else if (command === "status") {
      const subscribed = await isTelegramChatSubscribed(message.chat.id);
      await sendTelegramMessage(
        message.chat.id,
        subscribed
          ? "✅ 订阅中。"
          : "未订阅。发送 /subscribe 开启。"
      );
    } else if (command === "help") {
      await sendTelegramMessage(
        message.chat.id,
        "/subscribe 订阅\n/status 状态\n/stop 取消"
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook error";
    console.error("[telegram] Webhook processing failed:", message);
    return Response.json({ error: "Unable to process update" }, { status: 500 });
  }
}
