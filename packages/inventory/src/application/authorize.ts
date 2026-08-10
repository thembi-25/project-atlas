import type { DatabaseClient } from '@atlas/database';
import { findActiveMembershipByOrgAndUser, hasPermission } from '@atlas/identity';
import { isUserAssignedToJob } from '@atlas/jobs';
import { ForbiddenError, NotFoundError } from '../domain/errors';

/**
 * docs/03-domain/permissions.md/docs/03-domain/roles.md: a single
 * combined `inventory` resource (`read`/`write`/`consume`) covers
 * Inventory Items, Locations, Stock Movements, Job Parts, Suppliers, and
 * Purchase Orders — see docs/13-roadmap/sprint-6.md, "Scope decisions."
 * Mirrors @atlas/jobs's `requireJobsPermission`/@atlas/properties's
 * `requirePropertiesPermission`.
 */
export async function requireInventoryPermission(
  tx: DatabaseClient,
  params: {
    organizationId: string;
    actorUserId: string;
    action: 'read' | 'write' | 'consume';
  },
): Promise<void> {
  const membership = await findActiveMembershipByOrgAndUser(
    tx,
    params.organizationId,
    params.actorUserId,
  );
  if (!membership) {
    throw new NotFoundError('Organization');
  }
  const allowed = await hasPermission(tx, {
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    resource: 'inventory',
    action: params.action,
  });
  if (!allowed) {
    throw new ForbiddenError();
  }
}

/**
 * inventory-prd.md §12: "Technician: consume parts on assigned Jobs
 * (restricted to `job_parts` creation, not Inventory Item master data)."
 * An actor holding `inventory:write` (Owner/Admin) may consume on any
 * Job; an actor holding only `inventory:consume` (Technician) must be
 * assigned to the specific Job — mirrors @atlas/jobs's
 * `requireJobWriteAccess`'s `write`/`write_assigned` fallback pattern
 * exactly.
 */
export async function requireInventoryConsumeAccess(
  tx: DatabaseClient,
  params: { organizationId: string; actorUserId: string; jobId: string },
): Promise<void> {
  const hasWrite = await hasPermission(tx, {
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    resource: 'inventory',
    action: 'write',
  });
  if (hasWrite) return;
  const hasConsume = await hasPermission(tx, {
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    resource: 'inventory',
    action: 'consume',
  });
  const assigned = hasConsume && (await isUserAssignedToJob(tx, params.jobId, params.actorUserId));
  if (!assigned) {
    throw new ForbiddenError();
  }
}
