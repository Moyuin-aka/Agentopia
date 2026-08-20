export const TEXT_THEMES = [
  "notebook",
  "quote",
  "signal",
  "blueprint",
  "receipt",
  "orbit",
  "gradient",
  "terminal",
] as const;

export type TextTheme = (typeof TEXT_THEMES)[number];

const DEFAULT_TEXT_THEMES = [
  "notebook",
  "quote",
  "signal",
  "blueprint",
  "receipt",
  "orbit",
] as const satisfies readonly TextTheme[];

export function isTextTheme(value: unknown): value is TextTheme {
  return typeof value === "string" && TEXT_THEMES.includes(value as TextTheme);
}

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
