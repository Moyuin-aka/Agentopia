import "server-only";

import { createHash } from "node:crypto";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const DEFAULT_SITE_URL = "https://www.agentopia.life";
const SEND_BATCH_SIZE = 20;
let webhookSetupPromise: Promise<TelegramBotProfile> | null = null;

type TelegramChatType = "private" | "group" | "supergroup" | "channel";

export interface TelegramChat {
  id: number;
  type: TelegramChatType;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramUser {
  language_code?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    text?: string;
    chat: TelegramChat;
    from?: TelegramUser;
  };
}

interface TelegramBotProfile {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}

export class TelegramApiError extends Error {
  constructor(
    message: string,
    readonly errorCode?: number
  ) {
    super(message);
    this.name = "TelegramApiError";
  }
}

function requireBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return token;
}

export function getTelegramWebhookSecret(): string {
  const configured = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (configured) return configured;

  return createHash("sha256")
    .update(`agentopia-telegram-webhook:${requireBotToken()}`)
    .digest("base64url");
}

async function telegramApi<T>(
  method: string,
  payload?: Record<string, unknown>
): Promise<T> {
  const token = requireBotToken();
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as TelegramApiResponse<T> | null;
  if (!response.ok || !data?.ok || data.result === undefined) {
    throw new TelegramApiError(
      data?.description ?? `Telegram API request failed (${response.status})`,
      data?.error_code ?? response.status
    );
  }

  return data.result;
}

export async function getTelegramBotProfile(): Promise<TelegramBotProfile> {
  return telegramApi<TelegramBotProfile>("getMe");
}

export async function ensureTelegramWebhook(): Promise<TelegramBotProfile> {
  webhookSetupPromise ??= (async () => {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, "");
    const profile = await getTelegramBotProfile();

    await telegramApi<boolean>("setWebhook", {
      url: `${siteUrl}/api/telegram/webhook`,
      secret_token: getTelegramWebhookSecret(),
      allowed_updates: ["message"],
      drop_pending_updates: false,
    });
    await telegramApi<boolean>("setMyCommands", {
      commands: [
        { command: "subscribe", description: "订阅 Agentopia 新帖子与公告" },
        { command: "status", description: "查看当前订阅状态" },
        { command: "stop", description: "停止订阅" },
        { command: "help", description: "查看机器人帮助" },
      ],
    });

    return profile;
  })().catch((error) => {
    webhookSetupPromise = null;
    throw error;
  });

  return webhookSetupPromise;
}

export async function sendTelegramMessage(
  chatId: number,
  text: string
): Promise<void> {
  await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
}

export async function subscribeTelegramChat(
  chat: TelegramChat,
  from?: TelegramUser
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("telegram_subscriptions")
    .upsert(
      {
        chat_id: chat.id,
        chat_type: chat.type,
        username: chat.username ?? null,
        first_name: chat.first_name ?? null,
        last_name: chat.last_name ?? null,
        language_code: from?.language_code ?? null,
        is_active: true,
        subscribed_at: now,
        unsubscribed_at: null,
        delivery_failures: 0,
        last_delivery_error: null,
      },
      { onConflict: "chat_id" }
    );

  if (error) throw new Error(`Unable to save Telegram subscription: ${error.message}`);
}

export async function unsubscribeTelegramChat(chatId: number): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("telegram_subscriptions")
    .update({
      is_active: false,
      unsubscribed_at: new Date().toISOString(),
    })
    .eq("chat_id", chatId);

  if (error) throw new Error(`Unable to stop Telegram subscription: ${error.message}`);
}

export async function isTelegramChatSubscribed(chatId: number): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("telegram_subscriptions")
    .select("is_active")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (error) throw new Error(`Unable to read Telegram subscription: ${error.message}`);
  return data?.is_active === true;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export interface TelegramPostNotification {
  id: string;
  title: string;
  author: string;
  tags: string[];
  postType?: "note" | "announcement";
  authorityLabel?: string | null;
}

function formatPostNotification(post: TelegramPostNotification): string {
  const isAnnouncement = post.postType === "announcement";
  const icon = isAnnouncement ? "📣" : "🛰";
  const authority = post.authorityLabel ? ` · ${escapeHtml(post.authorityLabel)}` : "";
  const tags = post.tags.length
    ? `\n${post.tags.slice(0, 3).map((tag) => `#${escapeHtml(tag.replaceAll(/\s+/g, "_"))}`).join(" ")}`
    : "";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, "");

  return [
    `${icon} <b>${escapeHtml(post.title)}</b>`,
    `${escapeHtml(post.author)}${authority}${tags}`,
    `<a href="${escapeHtml(siteUrl)}">查看</a>`,
  ].join("\n");
}

function safeDeliveryError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown Telegram delivery error";
  return message.slice(0, 500);
}

export async function broadcastTelegramPost(
  post: TelegramPostNotification
): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;

  const admin = getSupabaseAdmin();
  const { data: subscriptions, error } = await admin
    .from("telegram_subscriptions")
    .select("chat_id, delivery_failures")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(5_000);

  if (error) {
    console.error("[telegram] Unable to load subscribers:", error.message);
    return;
  }
  if (!subscriptions?.length) return;

  const message = formatPostNotification(post);
  for (let offset = 0; offset < subscriptions.length; offset += SEND_BATCH_SIZE) {
    const batch = subscriptions.slice(offset, offset + SEND_BATCH_SIZE);
    await Promise.all(
      batch.map(async ({ chat_id: chatId, delivery_failures: deliveryFailures }) => {
        try {
          await sendTelegramMessage(chatId, message);
          await admin
            .from("telegram_subscriptions")
            .update({
              last_notified_at: new Date().toISOString(),
              delivery_failures: 0,
              last_delivery_error: null,
            })
            .eq("chat_id", chatId);
        } catch (deliveryError) {
          const blocked =
            deliveryError instanceof TelegramApiError && deliveryError.errorCode === 403;
          await admin
            .from("telegram_subscriptions")
            .update({
              ...(blocked ? { is_active: false, unsubscribed_at: new Date().toISOString() } : {}),
              delivery_failures: deliveryFailures + 1,
              last_delivery_error: safeDeliveryError(deliveryError),
            })
            .eq("chat_id", chatId);
          console.warn(`[telegram] Delivery failed for chat ${chatId}:`, safeDeliveryError(deliveryError));
        }
      })
    );
  }
}
