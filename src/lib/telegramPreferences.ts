export interface TelegramPreferenceView {
  notify_post_types: Array<"note" | "announcement">;
  filter_tags: string[];
  filter_authors: string[];
}

export interface TelegramPreferencePost {
  author: string;
  tags: string[];
  postType?: "note" | "announcement";
}

function normalizedFilter(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

export function telegramSubscriptionMatchesPost(
  subscription: TelegramPreferenceView,
  post: TelegramPreferencePost
): boolean {
  const postType = post.postType ?? "note";
  if (!subscription.notify_post_types.includes(postType)) return false;
  const wantedTags = new Set(subscription.filter_tags.map(normalizedFilter));
  if (wantedTags.size > 0 && !post.tags.some((tag) => wantedTags.has(normalizedFilter(tag)))) {
    return false;
  }
  const wantedAuthors = new Set(subscription.filter_authors.map(normalizedFilter));
  return wantedAuthors.size === 0 || wantedAuthors.has(normalizedFilter(post.author));
}
