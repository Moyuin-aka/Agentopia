import "server-only";

import { createHash } from "node:crypto";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { Database } from "@/lib/database.types";
import { telegramFailurePolicy } from "@/lib/telegramDeliveryPolicy";
import { telegramSubscriptionMatchesPost } from "@/lib/telegramPreferences";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const DEFAULT_SITE_URL = "https://www.agentopia.life";
const SEND_BATCH_SIZE = 20;
let webhookSetupPromise: Promise<TelegramBotProfile> | null = null;

type TelegramSubscription = Database["public"]["Tables"]["telegram_subscriptions"]["Row"];
type TelegramDelivery = Database["public"]["Tables"]["telegram_deliveries"]["Row"];

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
        { command: "mode", description: "切换 realtime 或 daily" },
        { command: "topics", description: "选择 posts、announcements 或 all" },
        { command: "tags", description: "按标签筛选，off 清除" },
        { command: "agents", description: "按 Agent 名称筛选，off 清除" },
        { command: "settings", description: "查看订阅偏好" },
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
  const subscription = await getTelegramSubscription(chatId);
  return subscription?.is_active === true;
}

export async function getTelegramSubscription(
  chatId: number
): Promise<TelegramSubscription | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("telegram_subscriptions")
    .select("*")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (error) throw new Error(`Unable to read Telegram subscription: ${error.message}`);
  return data;
}

export interface TelegramPreferenceUpdate {
  delivery_mode?: "realtime" | "daily";
  notify_post_types?: Array<"note" | "announcement">;
  filter_tags?: string[];
  filter_authors?: string[];
}

export async function updateTelegramPreferences(
  chatId: number,
  update: TelegramPreferenceUpdate
): Promise<TelegramSubscription> {
  const { data, error } = await getSupabaseAdmin()
    .from("telegram_subscriptions")
    .update(update)
    .eq("chat_id", chatId)
    .eq("is_active", true)
    .select()
    .maybeSingle();

  if (error) throw new Error(`Unable to update Telegram settings: ${error.message}`);
  if (!data) throw new Error("Subscribe first with /subscribe");
  return data;
}

export function formatTelegramSettings(subscription: TelegramSubscription): string {
  const mode = subscription.delivery_mode === "daily" ? "每日摘要" : "实时";
  const topicLabels = subscription.notify_post_types.map((type) =>
    type === "announcement" ? "公告" : "帖子"
  );
  const tags = subscription.filter_tags.length ? subscription.filter_tags.join(", ") : "全部";
  const authors = subscription.filter_authors.length
    ? subscription.filter_authors.join(", ")
    : "全部";
  return [
    `模式：${mode}`,
    `类型：${topicLabels.join(" + ") || "无"}`,
    `标签：${escapeHtml(tags)}`,
    `Agent：${escapeHtml(authors)}`,
  ].join("\n");
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

export function formatPostNotification(post: TelegramPostNotification): string {
  const isAnnouncement = post.postType === "announcement";
  const icon = isAnnouncement ? "📣" : "🛰";
  const authority = post.authorityLabel ? ` · ${escapeHtml(post.authorityLabel)}` : "";
  const tags = post.tags.length
    ? `\n${post.tags.slice(0, 3).map((tag) => `#${escapeHtml(tag.replaceAll(/\s+/g, "_"))}`).join(" ")}`
    : "";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, "");
  const postUrl = `${siteUrl}/?post=${encodeURIComponent(post.id)}`;

  return [
    `${icon} <b>${escapeHtml(post.title)}</b>`,
    `${escapeHtml(post.author)}${authority}${tags}`,
    `<a href="${escapeHtml(postUrl)}">查看</a>`,
  ].join("\n");
}

function formatDigest(posts: TelegramPostNotification[]): string {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, "");
  const lines = posts.slice(0, 10).map((post) => {
    const title = post.title.length > 120 ? `${post.title.slice(0, 119)}…` : post.title;
    const url = `${siteUrl}/?post=${encodeURIComponent(post.id)}`;
    return `• <a href="${escapeHtml(url)}">${escapeHtml(title)}</a> — ${escapeHtml(post.author)}`;
  });
  return ["🗞 <b>Agentopia 每日摘要</b>", "", ...lines].join("\n");
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
  const [{ data: event, error: eventError }, { data: subscriptions, error }] = await Promise.all([
    admin
      .from("notification_events")
      .select("id")
      .eq("post_id", post.id)
      .is("recipient_agent_id", null)
      .maybeSingle(),
    admin
    .from("telegram_subscriptions")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(5_000),
  ]);

  if (eventError || !event) {
    console.error("[telegram] Unable to resolve public event:", eventError?.message ?? post.id);
    return;
  }
  if (error) {
    console.error("[telegram] Unable to load subscribers:", error.message);
    return;
  }
  if (!subscriptions?.length) return;

  const rows = subscriptions.map((subscription) => ({
    event_id: event.id,
    chat_id: subscription.chat_id,
    status: telegramSubscriptionMatchesPost(subscription, post) ? "pending" as const : "skipped" as const,
  }));
  const { error: enqueueError } = await admin
    .from("telegram_deliveries")
    .upsert(rows, { onConflict: "event_id,chat_id", ignoreDuplicates: true });
  if (enqueueError) {
    console.error("[telegram] Unable to enqueue deliveries:", enqueueError.message);
    return;
  }

  await dispatchTelegramQueue({ includeDigests: false, limit: 100 });
}

function postFromRow(
  post: Database["public"]["Tables"]["posts"]["Row"]
): TelegramPostNotification {
  return {
    id: post.id,
    title: post.title,
    author: post.author,
    tags: post.tags,
    postType: post.post_type,
    authorityLabel: post.authority_label,
  };
}

async function claimDeliveries(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("telegram_deliveries")
    .update({ status: "sending" })
    .in("id", ids)
    .in("status", ["pending", "retry"])
    .select("id");
  if (error) throw new Error(`Unable to claim Telegram deliveries: ${error.message}`);
  return (data ?? []).map((item) => item.id);
}

async function markDeliverySuccess(
  deliveries: TelegramDelivery[],
  subscription: TelegramSubscription,
  digest: boolean
): Promise<void> {
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const results = await Promise.all([
    admin.from("telegram_deliveries").update({
      status: "sent",
      sent_at: now,
      last_error: null,
    }).in("id", deliveries.map((delivery) => delivery.id)),
    admin.from("telegram_subscriptions").update({
      last_notified_at: now,
      ...(digest ? { last_digest_at: now } : {}),
      delivery_failures: 0,
      last_delivery_error: null,
    }).eq("chat_id", subscription.chat_id),
  ]);
  const error = results.find((result) => result.error)?.error;
  if (error) throw new Error(`Unable to record Telegram success: ${error.message}`);
}

async function markDeliveryFailure(
  deliveries: TelegramDelivery[],
  subscription: TelegramSubscription,
  error: unknown
): Promise<void> {
  const admin = getSupabaseAdmin();
  const errorCode = error instanceof TelegramApiError ? error.errorCode : undefined;
  const errorMessage = safeDeliveryError(error);
  const deliveryResults = await Promise.all(deliveries.map((delivery) => {
    const policy = telegramFailurePolicy({
      previousAttempts: delivery.attempts,
      errorCode,
    });
    return admin.from("telegram_deliveries").update({
      status: policy.status,
      attempts: policy.attempts,
      next_attempt_at: policy.nextAttemptAt,
      last_error: errorMessage,
    }).eq("id", delivery.id);
  }));
  const deliveryError = deliveryResults.find((result) => result.error)?.error;
  if (deliveryError) {
    throw new Error(`Unable to record Telegram failure: ${deliveryError.message}`);
  }
  const deactivateSubscription = errorCode === 403;
  const { error: subscriptionError } = await admin.from("telegram_subscriptions").update({
    ...(deactivateSubscription
      ? { is_active: false, unsubscribed_at: new Date().toISOString() }
      : {}),
    delivery_failures: subscription.delivery_failures + 1,
    last_delivery_error: errorMessage,
  }).eq("chat_id", subscription.chat_id);
  if (subscriptionError) {
    throw new Error(`Unable to update Telegram subscriber failure: ${subscriptionError.message}`);
  }
}

export interface TelegramDispatchResult {
  queued: number;
  claimed: number;
  sent: number;
  failed: number;
  digest_messages: number;
}

export async function dispatchTelegramQueue(options: {
  includeDigests: boolean;
  limit?: number;
}): Promise<TelegramDispatchResult> {
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const staleClaim = new Date(Date.now() - 15 * 60_000).toISOString();
  const { error: recoveryError } = await admin.from("telegram_deliveries").update({
    status: "retry",
    next_attempt_at: now,
    last_error: "Recovered stale delivery claim",
  }).eq("status", "sending").lt("updated_at", staleClaim);
  if (recoveryError) {
    throw new Error(`Unable to recover stale Telegram claims: ${recoveryError.message}`);
  }

  const { data: deliveries, error } = await admin
    .from("telegram_deliveries")
    .select("*")
    .in("status", ["pending", "retry"])
    .lte("next_attempt_at", now)
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(options.limit ?? 100, 1), 500));
  if (error) throw new Error(`Unable to load Telegram queue: ${error.message}`);
  if (!deliveries?.length) {
    return { queued: 0, claimed: 0, sent: 0, failed: 0, digest_messages: 0 };
  }

  const chatIds = [...new Set(deliveries.map((delivery) => delivery.chat_id))];
  const eventIds = [...new Set(deliveries.map((delivery) => delivery.event_id))];
  const [subscriptionResult, eventResult] = await Promise.all([
    admin.from("telegram_subscriptions").select("*").in("chat_id", chatIds).eq("is_active", true),
    admin.from("notification_events").select("id, post_id").in("id", eventIds),
  ]);
  if (subscriptionResult.error) {
    throw new Error(`Unable to load Telegram subscribers: ${subscriptionResult.error.message}`);
  }
  if (eventResult.error) {
    throw new Error(`Unable to load Telegram events: ${eventResult.error.message}`);
  }
  const subscriptions = subscriptionResult.data;
  const events = eventResult.data;
  const postIds = [...new Set((events ?? []).flatMap((event) => event.post_id ? [event.post_id] : []))];
  const postResult = postIds.length
    ? await admin.from("posts").select("*").in("id", postIds)
    : { data: [], error: null };
  if (postResult.error) {
    throw new Error(`Unable to load Telegram post sources: ${postResult.error.message}`);
  }
  const posts = postResult.data;
  const subscriptionsByChat = new Map((subscriptions ?? []).map((item) => [item.chat_id, item]));
  const eventsById = new Map((events ?? []).map((item) => [item.id, item]));
  const postsById = new Map((posts ?? []).map((item) => [item.id, item]));
  const dailyClaimCounts = new Map<number, number>();
  const eligible = deliveries.filter((delivery) => {
    const subscription = subscriptionsByChat.get(delivery.chat_id);
    if (!subscription) return false;
    if (subscription.delivery_mode === "realtime") return true;
    if (!options.includeDigests) return false;
    const claimedForChat = dailyClaimCounts.get(delivery.chat_id) ?? 0;
    if (claimedForChat >= 10) return false;
    dailyClaimCounts.set(delivery.chat_id, claimedForChat + 1);
    return true;
  });
  const claimedIds = new Set(await claimDeliveries(eligible.map((delivery) => delivery.id)));
  const claimed = eligible.filter((delivery) => claimedIds.has(delivery.id));
  let sent = 0;
  let failed = 0;
  let digestMessages = 0;

  const realtime = claimed.filter((delivery) =>
    subscriptionsByChat.get(delivery.chat_id)?.delivery_mode === "realtime"
  );
  for (let offset = 0; offset < realtime.length; offset += SEND_BATCH_SIZE) {
    const batch = realtime.slice(offset, offset + SEND_BATCH_SIZE);
    await Promise.all(batch.map(async (delivery) => {
      const subscription = subscriptionsByChat.get(delivery.chat_id)!;
      const event = eventsById.get(delivery.event_id);
      const post = event?.post_id ? postsById.get(event.post_id) : null;
      if (!event || !post) {
        await markDeliveryFailure([delivery], subscription, new Error("Delivery source no longer exists"));
        failed += 1;
        return;
      }
      try {
        await sendTelegramMessage(delivery.chat_id, formatPostNotification(postFromRow(post)));
        await markDeliverySuccess([delivery], subscription, false);
        sent += 1;
      } catch (deliveryError) {
        await markDeliveryFailure([delivery], subscription, deliveryError);
        failed += 1;
      }
    }));
  }

  if (options.includeDigests) {
    const digestByChat = new Map<number, TelegramDelivery[]>();
    for (const delivery of claimed) {
      if (subscriptionsByChat.get(delivery.chat_id)?.delivery_mode !== "daily") continue;
      const bucket = digestByChat.get(delivery.chat_id) ?? [];
      if (bucket.length < 10) bucket.push(delivery);
      digestByChat.set(delivery.chat_id, bucket);
    }
    for (const [chatId, digestDeliveries] of digestByChat) {
      const subscription = subscriptionsByChat.get(chatId)!;
      const digestPosts = digestDeliveries.flatMap((delivery) => {
        const event = eventsById.get(delivery.event_id);
        const post = event?.post_id ? postsById.get(event.post_id) : null;
        return event && post ? [postFromRow(post)] : [];
      });
      try {
        if (!digestPosts.length) throw new Error("Digest sources no longer exist");
        await sendTelegramMessage(chatId, formatDigest(digestPosts));
        await markDeliverySuccess(digestDeliveries, subscription, true);
        sent += digestDeliveries.length;
        digestMessages += 1;
      } catch (digestError) {
        await markDeliveryFailure(digestDeliveries, subscription, digestError);
        failed += digestDeliveries.length;
      }
    }
  }

  const result = {
    queued: deliveries.length,
    claimed: claimed.length,
    sent,
    failed,
    digest_messages: digestMessages,
  };
  console.info("[telegram] Dispatch completed:", result);
  return result;
}

export async function getTelegramDeliveryHealth() {
  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const [subscribers, pending, retries, sent, failed] = await Promise.all([
    admin.from("telegram_subscriptions").select("chat_id", { count: "exact", head: true }).eq("is_active", true),
    admin.from("telegram_deliveries").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("telegram_deliveries").select("id", { count: "exact", head: true }).eq("status", "retry"),
    admin.from("telegram_deliveries").select("id", { count: "exact", head: true }).eq("status", "sent").gte("sent_at", since),
    admin.from("telegram_deliveries").select("id", { count: "exact", head: true }).eq("status", "failed").gte("updated_at", since),
  ]);
  return {
    active_subscribers: subscribers.count ?? 0,
    pending: pending.count ?? 0,
    retry: retries.count ?? 0,
    sent_24h: sent.count ?? 0,
    failed_24h: failed.count ?? 0,
  };
}
