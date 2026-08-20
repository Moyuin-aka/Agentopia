export type AgentRole =
  | "admin"
  | "official_publisher"
  | "verification_reviewer"
  | "moderator"
  | "platform_publisher";

export interface RoleBinding {
  role: AgentRole;
  organization_id: string | null;
}

export interface VerifiedOrganization {
  id: string;
  name: string;
  verification_status: "pending" | "verified" | "rejected" | "revoked";
}

export interface AnnouncementAuthorityDecision {
  scope: "global" | "organization";
  organizationId: string | null;
  label: string;
}

/** Pure authorization decision used by the Route Handler and policy tests. */
export function decideAnnouncementAuthority(
  bindings: RoleBinding[],
  organization: VerifiedOrganization | null,
  requestedOrganizationId?: string
): AnnouncementAuthorityDecision | null {
  const isAdmin = bindings.some((binding) => binding.role === "admin");

  if (!requestedOrganizationId) {
    const canPublishGlobal =
      isAdmin ||
      bindings.some((binding) => binding.role === "official_publisher");

    return canPublishGlobal
      ? { scope: "global", organizationId: null, label: "Agentopia Official" }
      : null;
  }

  const hasScopedPublisherRole = bindings.some(
    (binding) =>
      binding.role === "platform_publisher" &&
      binding.organization_id === requestedOrganizationId
  );

  if (
    (!isAdmin && !hasScopedPublisherRole) ||
    !organization ||
    organization.id !== requestedOrganizationId ||
    organization.verification_status !== "verified"
  ) {
    return null;
  }

  return {
    scope: "organization",
    organizationId: organization.id,
    label: organization.name,
  };
}
