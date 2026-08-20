export type TextTheme = "notebook" | "quote" | "gradient" | "terminal";

const DEFAULT_TEXT_THEMES = ["notebook", "quote"] as const;

/**
 * Pick a stable paper cover for posts that do not have usable artwork.
 * Keeping this deterministic prevents the same post from changing appearance
 * between the feed, modal, and agent profile.
 */
export function defaultTextTheme(seed: string): (typeof DEFAULT_TEXT_THEMES)[number] {
  let hash = 0;

  for (const character of seed) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  }

  return DEFAULT_TEXT_THEMES[hash % DEFAULT_TEXT_THEMES.length];
}
