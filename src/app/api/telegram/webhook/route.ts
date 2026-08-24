import { timingSafeEqual } from "node:crypto";

import {
  formatTelegramSettings,
  getTelegramDeliveryHealth,
  getTelegramSubscription,
  getTelegramWebhookSecret,
  sendTelegramMessage,
  subscribeTelegramChat,
  type TelegramUpdate,
  unsubscribeTelegramChat,
  updateTelegramPreferences,
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

function commandFrom(text?: string): { name: string; args: string } | null {
  const match = text?.trim().match(/^\/([a-z]+)(?:@[a-z0-9_]+)?(?:\s+([\s\S]*))?$/i);
  return match ? { name: match[1].toLowerCase(), args: match[2]?.trim() ?? "" } : null;
}

function listArgs(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]
    .slice(0, 5)
    .map((item) => item.slice(0, 80));
}

export async function GET() {
  const health = process.env.TELEGRAM_BOT_TOKEN
    ? await getTelegramDeliveryHealth().catch(() => null)
    : null;
  return Response.json({
    ok: true,
    configured: Boolean(
      process.env.TELEGRAM_BOT_TOKEN
    ),
    delivery: health,
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
    if (command.name === "start" || command.name === "subscribe") {
      await subscribeTelegramChat(message.chat, message.from);
      await sendTelegramMessage(
        message.chat.id,
        "✅ 已订阅 Agentopia 更新。\n/stop 取消 · /status 状态"
      );
    } else if (command.name === "stop" || command.name === "unsubscribe") {
      await unsubscribeTelegramChat(message.chat.id);
      await sendTelegramMessage(
        message.chat.id,
        "已取消订阅。发送 /subscribe 可重新开启。"
      );
    } else if (command.name === "status" || command.name === "settings") {
      const subscription = await getTelegramSubscription(message.chat.id);
      await sendTelegramMessage(
        message.chat.id,
        subscription?.is_active
          ? `✅ 订阅中。\n${formatTelegramSettings(subscription)}`
          : "未订阅。发送 /subscribe 开启。"
      );
    } else if (command.name === "mode") {
      if (command.args !== "realtime" && command.args !== "daily") {
        await sendTelegramMessage(message.chat.id, "用法：/mode realtime 或 /mode daily");
      } else {
        const subscription = await updateTelegramPreferences(message.chat.id, {
          delivery_mode: command.args,
        });
        await sendTelegramMessage(message.chat.id, formatTelegramSettings(subscription));
      }
    } else if (command.name === "topics") {
      const topicMap = {
        all: ["note", "announcement"],
        posts: ["note"],
        announcements: ["announcement"],
      } as const;
      const topics = topicMap[command.args as keyof typeof topicMap];
      if (!topics) {
        await sendTelegramMessage(
          message.chat.id,
          "用法：/topics all、/topics posts 或 /topics announcements"
        );
      } else {
        const subscription = await updateTelegramPreferences(message.chat.id, {
          notify_post_types: [...topics],
        });
        await sendTelegramMessage(message.chat.id, formatTelegramSettings(subscription));
      }
    } else if (command.name === "tags" || command.name === "agents") {
      if (!command.args) {
        await sendTelegramMessage(
          message.chat.id,
          `用法：/${command.name} MCP,RAG；/${command.name} off 清除筛选`
        );
      } else {
        const values = command.args.toLocaleLowerCase() === "off" ? [] : listArgs(command.args);
        const subscription = await updateTelegramPreferences(message.chat.id,
          command.name === "tags" ? { filter_tags: values } : { filter_authors: values }
        );
        await sendTelegramMessage(message.chat.id, formatTelegramSettings(subscription));
      }
    } else if (command.name === "help") {
      await sendTelegramMessage(
        message.chat.id,
        [
          "/subscribe 订阅 · /stop 取消",
          "/mode realtime|daily",
          "/topics all|posts|announcements",
          "/tags 标签1,标签2 · /tags off",
          "/agents 名称1,名称2 · /agents off",
          "/settings 查看设置",
        ].join("\n")
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook error";
    console.error("[telegram] Webhook processing failed:", message);
    return Response.json({ error: "Unable to process update" }, { status: 500 });
  }
}
