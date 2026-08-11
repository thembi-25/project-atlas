import type { DatabaseClient } from '@atlas/database';
import { hasPermission, listTeamIdsForUser, listUserIdsForTeams } from '@atlas/identity';
import { ForbiddenError } from '../domain/errors';

export type AnalyticsScope = 'organization' | 'team';

/**
 * roles.md, Role-to-module access summary: "Analytics/Reporting: Owner RW,
 * Admin RW, Dispatcher R (own team), Technician —, Accountant RW." Reuses
 * the pre-seeded `reports:read_organization`/`reports:read_own_team`
 * Permissions (Sprint 1 seed) rather than a new `analytics` resource — see
 * docs/13-roadmap/sprint-7.md, "Permission model." `read_organization`
 * implies `read_own_team` (broader access), so it's checked first.
 * `analytics-prd.md` §6/§12 additionally describes a Technician
 * self-utilization view, but the authoritative roles.md table and the
 * already-applied Sprint 1 seed grant Technician no `reports:*` Permission
 * at all — that inconsistency is resolved in favor of the seed/table (the
 * same precedent Sprint 6 used for an identical Suppliers PRD/table
 * mismatch); Technician self-utilization is not implemented.
 */
export async function requireAnalyticsAccess(
  tx: DatabaseClient,
  params: { organizationId: string; actorUserId: string },
): Promise<AnalyticsScope> {
  const hasOrganizationScope = await hasPermission(tx, {
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    resource: 'reports',
    action: 'read_organization',
  });
  if (hasOrganizationScope) return 'organization';

  const hasTeamScope = await hasPermission(tx, {
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    resource: 'reports',
    action: 'read_own_team',
  });
  if (hasTeamScope) return 'team';

  throw new ForbiddenError();
}

/**
 * Resolves the team-scope actor's own Technicians for
 * `mv_technician_utilization` — the only one of the four widgets with a
 * Technician/Team dimension in its data model at all (revenue,
 * job-volume, and invoice-aging carry no technician/team attribution:
 * Payments and Invoices aren't Technician-attributed, and Jobs aren't
 * Team-owned in this schema — only individually Technician-assigned via
 * `jobs.schedule_event_assignments`). A `team`-scope actor with
 * `read_own_team` sees those three org-level widgets unfiltered (there is
 * no team dimension to restrict by), and only utilization is genuinely
 * narrowed — see docs/13-roadmap/SPRINT-7-COMPLETION-REPORT.md for this
 * documented interpretation of roles.md's single "Analytics/Reporting"
 * row.
 */
export async function resolveTechnicianScope(
  tx: DatabaseClient,
  params: { organizationId: string; actorUserId: string; scope: AnalyticsScope },
): Promise<string[] | undefined> {
  if (params.scope === 'organization') return undefined;
  const teamIds = await listTeamIdsForUser(tx, params.organizationId, params.actorUserId);
  return listUserIdsForTeams(tx, teamIds);
}
