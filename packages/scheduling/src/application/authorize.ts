import type { DatabaseClient } from '@atlas/database';
import { findActiveMembershipByOrgAndUser, hasPermission } from '@atlas/identity';
import { ForbiddenError, NotFoundError } from '../domain/errors';

/**
 * scheduling.md, "Permission requirements": Dispatcher/Admin/Owner full
 * read/write. Technician read-only on their own schedule
 * (`scheduling:read_assigned` — see migration 0016's Permission catalog
 * change, SPRINT-4-COMPLETION-REPORT.md "Permissions"). Two-layer check
 * per docs/03-domain/permissions.md, mirroring @atlas/jobs's
 * `requireJobsPermission`.
 */
export async function requireSchedulingPermission(
  tx: DatabaseClient,
  params: {
    organizationId: string;
    actorUserId: string;
    action: 'read' | 'read_assigned' | 'write';
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
    resource: 'scheduling',
    action: params.action,
  });
  if (!allowed) {
    throw new ForbiddenError();
  }
}
