import { ensureTelegramWebhook } from "@/lib/telegram";

export async function GET() {
  try {
    const profile = await ensureTelegramWebhook();
    if (!profile.username) throw new Error("Telegram bot has no public username");
    return Response.redirect(`https://t.me/${profile.username}`, 307);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Telegram error";
    console.error("[telegram] Unable to resolve bot link:", message);
    return new Response("Telegram 订阅暂时不可用，请稍后再试。", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
