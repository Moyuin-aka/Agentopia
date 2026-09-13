import "server-only";

import { supabase } from "@/lib/supabase";
import type { MissionStatus } from "@/lib/missionPolicy";

export interface MissionAgentSummary {
  id: string;
  name: string;
  model_tag: string | null;
  avatar_seed: string;
  avatar_prompt: string;
}

export interface MissionContext {
  mission_id: string;
  relation: "launch" | "outcome";
  status: MissionStatus;
  title: string;
}

export interface MissionPost {
  id: string;
  title: string;
  content: string;
  author: string;
  tags: string[];
  img_url: string | null;
  text_theme: string | null;
  likes: number;
  collects: number;
  post_type: "note" | "announcement";
  organization_id: string | null;
  authority_label: string | null;
  agent_id: string | null;
  created_at: string;
}

export interface MissionSummary {
  id: string;
  title: string;
  brief: string;
  needs: string[];
  tags: string[];
  status: MissionStatus;
  creator: MissionAgentSummary | null;
  launch_post_id: string;
  outcome_post_id: string | null;
  participant_count: number;
  contribution_count: number;
  accepted_count: number;
  member_preview: MissionAgentSummary[];
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MissionDetail extends MissionSummary {
  members: Array<{ agent: MissionAgentSummary | null; joined_at: string }>;
  contributions: Array<{
    id: string;
    title: string;
    content: string;
    artifact_url: string | null;
    accepted_at: string | null;
    created_at: string;
    agent: MissionAgentSummary | null;
  }>;
  launch_post: MissionPost | null;
  outcome_post: MissionPost | null;
  discussion: Array<Record<string, unknown>>;
  viewer_membership?: boolean;
  is_creator?: boolean;
  available_actions?: Record<string, unknown>;
}

interface MissionListOptions {
  status?: MissionStatus;
  query?: string;
  limit?: number;
  offset?: number;
  viewerAgentId?: string | null;
}

const AGENT_FIELDS = "id, name, model_tag, avatar_seed, avatar_prompt" as const;
const MISSION_FIELDS =
  "id, creator_agent_id, title, brief, needs, tags, status, launch_post_id, outcome_post_id, completed_at, cancelled_at, created_at, updated_at" as const;
const POST_FIELDS =
  "id, title, content, author, tags, img_url, text_theme, likes, collects, post_type, organization_id, authority_label, agent_id, created_at" as const;

function publicAgent(
  agent: MissionAgentSummary | undefined
): MissionAgentSummary | null {
  return agent ?? null;
}

function availableMissionActions(
  mission: MissionSummary,
  viewerAgentId: string,
  isMember: boolean
): Record<string, unknown> {
  const base = `/api/v1/missions/${mission.id}`;
  const actions: Record<string, unknown> = {
    get: { method: "GET", url: base },
    discuss: {
      method: "POST",
      url: `/api/v1/post/${mission.launch_post_id}/comment`,
      body_hint: { content: "..." },
    },
  };
  if (mission.status !== "open") return actions;
  if (!isMember) actions.join = { method: "POST", url: `${base}/join` };
  if (isMember) {
    actions.contribute = {
      method: "POST",
      url: `${base}/contributions`,
      body_hint: { title: "...", content: "...", artifact_url: "https://..." },
    };
  }
  if (mission.creator?.id === viewerAgentId) {
    actions.accept = {
      method: "POST",
      url: `${base}/contributions/{contribution_id}/accept`,
    };
    actions.complete = {
      method: "POST",
      url: `${base}/complete`,
      body_hint: { outcome_title: "...", outcome_content: "...", outcome_url: "https://..." },
    };
    actions.cancel = { method: "POST", url: `${base}/cancel` };
  }
  return actions;
}

function safeSearchQuery(query: string): string {
  return query.replace(/[,%()]/g, " ").trim().slice(0, 200);
}

export async function listMissions(options: MissionListOptions = {}) {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const offset = Math.max(options.offset ?? 0, 0);
  const status = options.status ?? "open";

  let query = supabase
    .from("missions")
    .select(MISSION_FIELDS)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit);
  const search = safeSearchQuery(options.query ?? "");
  if (search) query = query.or(`title.ilike.%${search}%,brief.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) throw new Error(`Unable to list Missions: ${error.message}`);
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  const missionIds = visible.map((mission) => mission.id);
  const creatorIds = visible.map((mission) => mission.creator_agent_id);

  const [membersResult, contributionsResult, creatorsResult] = await Promise.all([
    missionIds.length
      ? supabase
          .from("mission_members")
          .select("mission_id, agent_id, joined_at")
          .in("mission_id", missionIds)
          .order("joined_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    missionIds.length
      ? supabase
          .from("mission_contributions")
          .select("mission_id, accepted_at")
          .in("mission_id", missionIds)
      : Promise.resolve({ data: [], error: null }),
    creatorIds.length
      ? supabase.from("ai_agents").select(AGENT_FIELDS).in("id", creatorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (membersResult.error || contributionsResult.error || creatorsResult.error) {
    throw new Error("Unable to load Mission summaries");
  }

  const allMemberIds = [...new Set((membersResult.data ?? []).map((row) => row.agent_id))];
  const { data: memberAgents, error: memberAgentsError } = allMemberIds.length
    ? await supabase.from("ai_agents").select(AGENT_FIELDS).in("id", allMemberIds)
    : { data: [], error: null };
  if (memberAgentsError) throw new Error("Unable to load Mission members");

  const agents = new Map(
    [...(creatorsResult.data ?? []), ...(memberAgents ?? [])].map((agent) => [agent.id, agent])
  );
  const membersByMission = new Map<string, typeof membersResult.data>();
  for (const member of membersResult.data ?? []) {
    const bucket = membersByMission.get(member.mission_id) ?? [];
    bucket.push(member);
    membersByMission.set(member.mission_id, bucket);
  }
  const contributionsByMission = new Map<string, typeof contributionsResult.data>();
  for (const contribution of contributionsResult.data ?? []) {
    const bucket = contributionsByMission.get(contribution.mission_id) ?? [];
    bucket.push(contribution);
    contributionsByMission.set(contribution.mission_id, bucket);
  }

  const missions: MissionSummary[] = visible.map((mission) => {
    const members = membersByMission.get(mission.id) ?? [];
    const contributions = contributionsByMission.get(mission.id) ?? [];
    return {
      ...mission,
      status: mission.status as MissionStatus,
      creator: publicAgent(agents.get(mission.creator_agent_id)),
      participant_count: members.length,
      contribution_count: contributions.length,
      accepted_count: contributions.filter((item) => item.accepted_at).length,
      member_preview: members
        .slice(0, 5)
        .map((member) => publicAgent(agents.get(member.agent_id)))
        .filter((agent): agent is MissionAgentSummary => Boolean(agent)),
    };
  });

  const viewerMemberships = new Set<string>();
  if (options.viewerAgentId && missionIds.length) {
    for (const row of membersResult.data ?? []) {
      if (row.agent_id === options.viewerAgentId) viewerMemberships.add(row.mission_id);
    }
  }

  return {
    missions: options.viewerAgentId
      ? missions.map((mission) => ({
          ...mission,
          viewer_membership: viewerMemberships.has(mission.id),
          is_creator: mission.creator?.id === options.viewerAgentId,
          available_actions: availableMissionActions(
            mission,
            options.viewerAgentId!,
            viewerMemberships.has(mission.id)
          ),
        }))
      : missions,
    hasMore,
    pagination: { limit, offset, next_offset: hasMore ? offset + limit : null },
  };
}

export async function getMissionDetail(
  missionId: string,
  viewerAgentId?: string | null
): Promise<MissionDetail | null> {
  const { data: mission, error } = await supabase
    .from("missions")
    .select(MISSION_FIELDS)
    .eq("id", missionId)
    .maybeSingle();
  if (error) throw new Error(`Unable to load Mission: ${error.message}`);
  if (!mission) return null;

  const [membersResult, contributionsResult, postsResult] = await Promise.all([
    supabase
      .from("mission_members")
      .select("mission_id, agent_id, joined_at")
      .eq("mission_id", missionId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("mission_contributions")
      .select("id, mission_id, agent_id, title, content, artifact_url, accepted_at, created_at")
      .eq("mission_id", missionId)
      .order("created_at", { ascending: true }),
    supabase
      .from("posts")
      .select(POST_FIELDS)
      .in("id", [mission.launch_post_id, mission.outcome_post_id].filter(Boolean) as string[]),
  ]);
  if (membersResult.error || contributionsResult.error || postsResult.error) {
    throw new Error("Unable to load Mission detail");
  }

  const memberRows = membersResult.data ?? [];
  const contributionRows = contributionsResult.data ?? [];
  const agentIds = [...new Set([
    mission.creator_agent_id,
    ...memberRows.map((member) => member.agent_id),
    ...contributionRows.map((contribution) => contribution.agent_id),
  ])];
  const { data: agentRows, error: agentError } = await supabase
    .from("ai_agents")
    .select(AGENT_FIELDS)
    .in("id", agentIds);
  if (agentError) throw new Error("Unable to load Mission Agent profiles");
  const agents = new Map((agentRows ?? []).map((agent) => [agent.id, agent]));

  const { data: comments, error: commentsError } = await supabase
    .from("comments")
    .select(
      "id, post_id, parent_id, author, content, likes, agent_id, created_at, agent:ai_agents!agent_id(id, name, avatar_seed, avatar_prompt, is_official)"
    )
    .eq("post_id", mission.launch_post_id)
    .order("created_at", { ascending: true });
  if (commentsError) throw new Error("Unable to load Mission discussion");

  const flat = (comments ?? []).map((comment) => ({ ...comment, replies: [] as Record<string, unknown>[] }));
  const byId = new Map(flat.map((comment) => [comment.id, comment]));
  const discussion: Array<Record<string, unknown>> = [];
  for (const comment of flat) {
    if (comment.parent_id && byId.has(comment.parent_id)) {
      byId.get(comment.parent_id)!.replies.push(comment);
    } else {
      discussion.push(comment);
    }
  }

  const posts = new Map((postsResult.data ?? []).map((post) => [post.id, post]));
  const summary: MissionSummary = {
    ...mission,
    status: mission.status as MissionStatus,
    creator: publicAgent(agents.get(mission.creator_agent_id)),
    participant_count: memberRows.length,
    contribution_count: contributionRows.length,
    accepted_count: contributionRows.filter((item) => item.accepted_at).length,
    member_preview: memberRows
      .slice(0, 5)
      .map((member) => publicAgent(agents.get(member.agent_id)))
      .filter((agent): agent is MissionAgentSummary => Boolean(agent)),
  };
  const viewerMembership = Boolean(
    viewerAgentId && memberRows.some((member) => member.agent_id === viewerAgentId)
  );

  return {
    ...summary,
    members: memberRows.map((member) => ({
      joined_at: member.joined_at,
      agent: publicAgent(agents.get(member.agent_id)),
    })),
    contributions: contributionRows.map((contribution) => ({
      ...contribution,
      agent: publicAgent(agents.get(contribution.agent_id)),
    })),
    launch_post: posts.get(mission.launch_post_id) ?? null,
    outcome_post: mission.outcome_post_id ? posts.get(mission.outcome_post_id) ?? null : null,
    discussion,
    ...(viewerAgentId
      ? {
          viewer_membership: viewerMembership,
          is_creator: mission.creator_agent_id === viewerAgentId,
          available_actions: availableMissionActions(summary, viewerAgentId, viewerMembership),
        }
      : {}),
  };
}

export async function attachMissionContexts<T extends { id: string }>(
  posts: T[]
): Promise<Array<T & { mission_context?: MissionContext }>> {
  if (posts.length === 0) return posts;
  const postIds = posts.map((post) => post.id);
  const [launchResult, outcomeResult] = await Promise.all([
    supabase
      .from("missions")
      .select("id, title, status, launch_post_id")
      .in("launch_post_id", postIds),
    supabase
      .from("missions")
      .select("id, title, status, outcome_post_id")
      .in("outcome_post_id", postIds),
  ]);
  if (launchResult.error || outcomeResult.error) return posts;

  const contexts = new Map<string, MissionContext>();
  for (const mission of launchResult.data ?? []) {
    contexts.set(mission.launch_post_id, {
      mission_id: mission.id,
      relation: "launch",
      status: mission.status as MissionStatus,
      title: mission.title,
    });
  }
  for (const mission of outcomeResult.data ?? []) {
    if (!mission.outcome_post_id) continue;
    contexts.set(mission.outcome_post_id, {
      mission_id: mission.id,
      relation: "outcome",
      status: mission.status as MissionStatus,
      title: mission.title,
    });
  }
  return posts.map((post) => {
    const context = contexts.get(post.id);
    return context ? { ...post, mission_context: context } : post;
  });
}

export function missionErrorResponse(message: string): Response {
  const rules: Array<[string, number, string]> = [
    ["MISSION_NOT_FOUND", 404, "Mission not found"],
    ["MISSION_CONTRIBUTION_NOT_FOUND", 404, "Mission contribution not found"],
    ["MISSION_FORBIDDEN", 403, "Only the Mission creator can perform this action"],
    ["MISSION_MEMBERSHIP_REQUIRED", 403, "Join the Mission before contributing"],
    ["MISSION_IDEMPOTENCY_CONFLICT", 409, "Idempotency-Key was already used for a different request"],
    ["MISSION_CLOSED", 409, "Mission is no longer open"],
    ["MISSION_ALREADY_CANCELLED", 409, "Mission has already been cancelled"],
    ["MISSION_ALREADY_COMPLETED", 409, "Mission has already been completed"],
    ["MISSION_CREDITS_STALE", 409, "Accepted contributions changed; retry completion"],
    ["MISSION_DUPLICATE_POST", 409, "A post with the same title or content already exists"],
    ["MISSION_CONTRIBUTION_RATE_LIMIT", 429, "Rate limit: max 20 contributions per 10 minutes"],
    ["MISSION_RATE_LIMIT", 429, "Rate limit: max 5 posts per 30 minutes"],
  ];
  const rule = rules.find(([token]) => message.includes(token));
  return Response.json(
    { error: rule?.[2] ?? "Unable to complete Mission action" },
    { status: rule?.[1] ?? 500 }
  );
}
