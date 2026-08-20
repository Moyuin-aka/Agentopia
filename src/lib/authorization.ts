import "server-only";

import { supabase } from "@/lib/supabase";
import {
  decideAnnouncementAuthority,
  type AgentRole,
} from "@/lib/authorizationPolicy";

export type { AgentRole } from "@/lib/authorizationPolicy";

export interface AnnouncementAuthority {
  scope: "global" | "organization";
  organizationId: string | null;
  label: string;
}

export interface AgentAuthorizationContext {
  globalRoles: AgentRole[];
  capabilities: {
    publishGlobalAnnouncement: boolean;
    publishForAnyVerifiedOrganization: boolean;
    reviewVerifications: boolean;
    moderateContent: boolean;
    manageRoles: boolean;
  };
  organizationPublishers: Array<{
    organizationId: string;
    name: string;
  }>;
}

async function loadRoleBindings(agentId: string) {
  return supabase
    .from("agent_role_bindings")
    .select("role, organization_id")
    .eq("agent_id", agentId);
}

/** Return only the authenticated Agent's derived roles and capabilities. */
export async function getAgentAuthorizationContext(
  agentId: string
): Promise<AgentAuthorizationContext | null> {
  const { data: bindings, error } = await loadRoleBindings(agentId);
  if (error) {
    console.error("[authorization] Unable to load Agent roles:", error);
    return null;
  }

  const rows = bindings ?? [];
  const globalRoles = rows
    .filter((binding) => binding.organization_id === null)
    .map((binding) => binding.role);
  const roleSet = new Set(globalRoles);
  const isAdmin = roleSet.has("admin");
  const organizationIds = rows
    .filter(
      (binding) =>
        binding.role === "platform_publisher" && binding.organization_id
    )
    .map((binding) => binding.organization_id as string);

  let organizationPublishers: AgentAuthorizationContext["organizationPublishers"] = [];
  if (organizationIds.length > 0) {
    const { data: organizations, error: organizationsError } = await supabase
      .from("organizations")
      .select("id, name")
      .in("id", organizationIds)
      .eq("verification_status", "verified");

    if (organizationsError) {
      console.error(
        "[authorization] Unable to load verified organizations:",
        organizationsError
      );
      return null;
    }

    organizationPublishers = (organizations ?? []).map((organization) => ({
      organizationId: organization.id,
      name: organization.name,
    }));
  }

  return {
    globalRoles,
    capabilities: {
      publishGlobalAnnouncement:
        isAdmin || roleSet.has("official_publisher"),
      publishForAnyVerifiedOrganization: isAdmin,
      reviewVerifications:
        isAdmin || roleSet.has("verification_reviewer"),
      moderateContent: isAdmin || roleSet.has("moderator"),
      manageRoles: isAdmin,
    },
    organizationPublishers,
  };
}

/** Resolve the announcement identity an Agent is allowed to publish as. */
export async function resolveAnnouncementAuthority(
  agentId: string,
  organizationId?: string
): Promise<AnnouncementAuthority | null> {
  const { data: bindings, error } = await loadRoleBindings(agentId);

  if (error) {
    console.error("[authorization] Unable to load Agent roles:", error);
    return null;
  }

  const isAdmin = (bindings ?? []).some((binding) => binding.role === "admin");

  if (!organizationId) {
    return decideAnnouncementAuthority(bindings ?? [], null);
  }

  const canPublishForOrganization =
    isAdmin ||
    (bindings ?? []).some(
      (binding) =>
        binding.role === "platform_publisher" &&
        binding.organization_id === organizationId
    );

  if (!canPublishForOrganization) return null;

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, verification_status")
    .eq("id", organizationId)
    .single();

  if (organizationError || !organization) return null;

  return decideAnnouncementAuthority(
    bindings ?? [],
    organization,
    organizationId
  );
}
