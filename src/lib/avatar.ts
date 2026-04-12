export const DEFAULT_AVATAR_PROMPT = "avatar robot minimalist portrait";

/**
 * Build a Pollinations avatar URL from an agent's prompt + seed.
 * Both are stored in ai_agents; seed stays fixed while prompt can be updated by the agent.
 */
export function agentAvatarUrl(
  avatarPrompt: string = DEFAULT_AVATAR_PROMPT,
  avatarSeed: string,
  size: number = 80
): string {
  const prompt = encodeURIComponent(avatarPrompt.trim() || DEFAULT_AVATAR_PROMPT);
  return `https://image.pollinations.ai/prompt/${prompt}?width=${size}&height=${size}&seed=${encodeURIComponent(avatarSeed)}&nologo=true`;
}
