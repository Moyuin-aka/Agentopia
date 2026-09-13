import { createHash } from "node:crypto";

export const MISSION_STATUSES = ["open", "completed", "cancelled"] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export interface MissionCreateInput {
  title: string;
  brief: string;
  needs: string[];
  tags: string[];
}

export interface MissionContributionInput {
  title: string;
  content: string;
  artifactUrl: string | null;
}

export interface MissionOutcomeInput {
  title: string;
  content: string;
  outcomeUrl: string | null;
}

export interface AcceptedContributionCredit {
  agentId: string;
  agentName: string;
  title: string;
  artifactUrl: string | null;
  acceptedAt: string;
  createdAt: string;
}

export class MissionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissionInputError";
  }
}

function decodeCommonEscapes(value: string): string {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    )
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function requiredString(
  value: unknown,
  field: string,
  maxLength: number
): string {
  const normalized = decodeCommonEscapes(String(value ?? ""));
  if (!normalized) throw new MissionInputError(`${field} is required`);
  if (normalized.length > maxLength) {
    throw new MissionInputError(`${field} must be ${maxLength} characters or fewer`);
  }
  return normalized;
}

function uniqueStrings(
  value: unknown,
  field: string,
  maxItems: number,
  maxLength: number,
  required: boolean
): string[] {
  if (!Array.isArray(value)) {
    if (required) throw new MissionInputError(`${field} must be an array`);
    return [];
  }

  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") {
      throw new MissionInputError(`${field} must contain only strings`);
    }
    const item = decodeCommonEscapes(raw);
    if (!item) continue;
    if (item.length > maxLength) {
      throw new MissionInputError(
        `${field} items must be ${maxLength} characters or fewer`
      );
    }
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }

  if (required && result.length === 0) {
    throw new MissionInputError(`${field} must contain at least one item`);
  }
  if (result.length > maxItems) {
    throw new MissionInputError(`${field} must contain ${maxItems} items or fewer`);
  }
  return result;
}

function optionalHttpUrl(value: unknown, field: string): string | null {
  const normalized = decodeCommonEscapes(String(value ?? ""));
  if (!normalized) return null;
  if (normalized.length > 2048) {
    throw new MissionInputError(`${field} must be 2,048 characters or fewer`);
  }

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new MissionInputError(`${field} must be a valid HTTP(S) URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new MissionInputError(`${field} must use HTTP or HTTPS`);
  }
  return url.toString();
}

export function parseMissionCreateInput(body: Record<string, unknown>): MissionCreateInput {
  return {
    title: requiredString(body.title, "title", 200),
    brief: requiredString(body.brief, "brief", 10_000),
    needs: uniqueStrings(body.needs, "needs", 6, 80, true),
    tags: uniqueStrings(body.tags ?? [], "tags", 4, 40, false),
  };
}

export function parseMissionContributionInput(
  body: Record<string, unknown>
): MissionContributionInput {
  return {
    title: requiredString(body.title, "title", 160),
    content: requiredString(body.content, "content", 5_000),
    artifactUrl: optionalHttpUrl(body.artifact_url, "artifact_url"),
  };
}

export function parseMissionOutcomeInput(
  body: Record<string, unknown>
): MissionOutcomeInput {
  return {
    title: requiredString(body.outcome_title, "outcome_title", 200),
    content: requiredString(body.outcome_content, "outcome_content", 10_000),
    outcomeUrl: optionalHttpUrl(body.outcome_url, "outcome_url"),
  };
}

export function buildMissionLaunchPost(input: MissionCreateInput): {
  title: string;
  content: string;
  tags: string[];
} {
  const needs = input.needs.map((need) => `- ${need}`).join("\n");
  return {
    title: input.title,
    content: `${input.brief}\n\n---\n\n## 正在寻找\n${needs}`,
    tags: ["Mission", ...input.tags],
  };
}

export function escapeMarkdownInline(value: string): string {
  return value.replace(/([\\`*_{}\[\]()<>#+\-.!|])/g, "\\$1");
}

export function buildMissionOutcomePost(
  input: MissionOutcomeInput,
  missionTags: string[],
  credits: AcceptedContributionCredit[]
): { title: string; content: string; tags: string[] } {
  const sections = [input.content];

  if (input.outcomeUrl) {
    sections.push(`## 作品链接\n[查看成果](${input.outcomeUrl})`);
  }

  const sorted = [...credits].sort((a, b) => {
    const accepted = a.acceptedAt.localeCompare(b.acceptedAt);
    return accepted || a.createdAt.localeCompare(b.createdAt);
  });
  const grouped = new Map<string, AcceptedContributionCredit[]>();
  for (const credit of sorted) {
    const items = grouped.get(credit.agentId) ?? [];
    items.push(credit);
    grouped.set(credit.agentId, items);
  }

  if (grouped.size > 0) {
    const lines = [...grouped.values()].flatMap((items) => {
      const agentName = escapeMarkdownInline(items[0].agentName);
      return [
        `- **@${agentName}**`,
        ...items.map((item) => {
          const title = escapeMarkdownInline(item.title);
          return item.artifactUrl
            ? `  - ${title} — [查看贡献](${item.artifactUrl})`
            : `  - ${title}`;
        }),
      ];
    });
    sections.push(`## 共同贡献者\n${lines.join("\n")}`);
  }

  return {
    title: input.title,
    content: sections.join("\n\n---\n\n"),
    tags: ["Mission成果", ...missionTags.slice(0, 4)],
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function missionRequestIdentity(
  agentId: string,
  operation: "create" | "contribute",
  normalizedBody: unknown,
  clientKey: string | null,
  now = Date.now()
): { idempotencyKey: string; requestHash: string } {
  const canonical = stableJson(normalizedBody);
  const requestHash = sha256Text(canonical);
  const supplied = clientKey?.trim() ?? "";
  if (supplied.length > 200) {
    throw new MissionInputError("Idempotency-Key must be 200 characters or fewer");
  }
  const bucket = Math.floor(now / (10 * 60 * 1000));
  const source = supplied
    ? `client:${agentId}:${operation}:${supplied}`
    : `auto:${agentId}:${operation}:${bucket}:${canonical}`;
  return { idempotencyKey: sha256Text(source), requestHash };
}
