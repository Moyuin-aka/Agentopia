import { createHash } from "node:crypto";

export type RankedKnowledgeSourceType = "post" | "comment" | "api_doc";

export interface RankableKnowledge {
  id: string;
  source_type: RankedKnowledgeSourceType;
  source_id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface RankKnowledgeOptions {
  limit: number;
  diversityLambda?: number;
  maxPerSource?: number;
  maxPerAuthor?: number;
}

export interface RankKnowledgeDiagnostics {
  candidate_count: number;
  exact_duplicates_removed: number;
  returned_count: number;
  diversity_lambda: number;
  max_per_source: number;
  max_per_author: number;
}

function normalizedContent(content: string): string {
  return content.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function contentFingerprint(content: string): string {
  return createHash("sha256").update(normalizedContent(content)).digest("hex");
}

function contentFeatures(content: string): Set<string> {
  const normalized = normalizedContent(content);
  const features = new Set<string>();
  const words = normalized.match(/[\p{L}\p{N}_-]{2,}/gu) ?? [];
  for (const word of words) features.add(`w:${word}`);

  const compact = normalized.replace(/\s+/g, "").slice(0, 1_500);
  for (let index = 0; index < compact.length - 2; index += 1) {
    features.add(`c:${compact.slice(index, index + 3)}`);
  }
  return features;
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const feature of left) {
    if (right.has(feature)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

function authorKey(item: RankableKnowledge): string | null {
  const agentId = item.metadata.agent_id;
  if (typeof agentId === "string" && agentId) return `agent:${agentId}`;
  const author = item.metadata.author;
  return typeof author === "string" && author.trim()
    ? `author:${author.trim().toLocaleLowerCase()}`
    : null;
}

function sourceBoost(sourceType: RankedKnowledgeSourceType): number {
  if (sourceType === "post") return 0.035;
  if (sourceType === "api_doc") return 0.015;
  return 0;
}

/** Exact dedupe + per-source/author caps + lexical MMR diversity reranking. */
export function rankKnowledgeResults<T extends RankableKnowledge>(
  candidates: T[],
  options: RankKnowledgeOptions
): T[] {
  return rankKnowledgeResultsWithDiagnostics(candidates, options).results;
}

export function rankKnowledgeResultsWithDiagnostics<T extends RankableKnowledge>(
  candidates: T[],
  options: RankKnowledgeOptions
): { results: T[]; diagnostics: RankKnowledgeDiagnostics } {
  const limit = Math.max(1, options.limit);
  const diversityLambda = Math.min(Math.max(options.diversityLambda ?? 0.72, 0.5), 1);
  const maxPerSource = Math.max(1, options.maxPerSource ?? 1);
  const maxPerAuthor = Math.max(1, options.maxPerAuthor ?? 2);
  const seenContent = new Set<string>();
  const unique = candidates.filter((candidate) => {
    const fingerprint = contentFingerprint(candidate.content);
    if (seenContent.has(fingerprint)) return false;
    seenContent.add(fingerprint);
    return true;
  });
  const features = new Map(unique.map((item) => [item.id, contentFeatures(item.content)]));
  const selected: T[] = [];
  const sourceCounts = new Map<string, number>();
  const authorCounts = new Map<string, number>();
  const remaining = [...unique];

  while (selected.length < limit && remaining.length > 0) {
    let bestIndex = -1;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const sourceKey = `${candidate.source_type}:${candidate.source_id}`;
      const candidateAuthor = authorKey(candidate);
      if ((sourceCounts.get(sourceKey) ?? 0) >= maxPerSource) continue;
      if (candidateAuthor && (authorCounts.get(candidateAuthor) ?? 0) >= maxPerAuthor) continue;

      const redundancy = selected.reduce((maximum, item) => {
        const similarity = jaccard(
          features.get(candidate.id) ?? new Set(),
          features.get(item.id) ?? new Set()
        );
        return Math.max(maximum, similarity);
      }, 0);
      const relevance = candidate.similarity + sourceBoost(candidate.source_type);
      const score = diversityLambda * relevance - (1 - diversityLambda) * redundancy;
      if (score > bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    }

    if (bestIndex < 0) break;
    const [chosen] = remaining.splice(bestIndex, 1);
    selected.push(chosen);
    const sourceKey = `${chosen.source_type}:${chosen.source_id}`;
    sourceCounts.set(sourceKey, (sourceCounts.get(sourceKey) ?? 0) + 1);
    const chosenAuthor = authorKey(chosen);
    if (chosenAuthor) {
      authorCounts.set(chosenAuthor, (authorCounts.get(chosenAuthor) ?? 0) + 1);
    }
  }

  return {
    results: selected,
    diagnostics: {
      candidate_count: candidates.length,
      exact_duplicates_removed: candidates.length - unique.length,
      returned_count: selected.length,
      diversity_lambda: diversityLambda,
      max_per_source: maxPerSource,
      max_per_author: maxPerAuthor,
    },
  };
}
