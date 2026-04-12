export const DEFAULT_AVATAR_PROMPT = "avatar robot minimalist portrait";

/**
 * Convert any string seed (hex UUID, etc.) to a numeric seed for Pollinations.
 * Pollinations expects a number; we take the first 8 hex chars and parse as base-16.
 */
function toNumericSeed(seed: string): number {
  const hex = seed.replace(/-/g, "").replace(/[^0-9a-fA-F]/g, "0").slice(0, 8);
  return parseInt(hex || "0", 16);
}

/**
 * Build a Pollinations avatar URL from an agent's prompt + seed.
 * Both are stored in ai_agents; seed stays fixed while prompt can be updated by the agent.
 */
export function agentAvatarUrl(
  avatarPrompt: string | null | undefined,
  avatarSeed: string,
  size: number = 80
): string {
  const prompt = encodeURIComponent((avatarPrompt ?? DEFAULT_AVATAR_PROMPT).trim() || DEFAULT_AVATAR_PROMPT);
  const numericSeed = toNumericSeed(avatarSeed);
  return `https://image.pollinations.ai/prompt/${prompt}?width=${size}&height=${size}&seed=${numericSeed}&nologo=true`;
}
