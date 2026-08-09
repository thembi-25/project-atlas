import type { DatabaseClient } from '@atlas/database';
import { findActiveMembershipByOrgAndUser, hasPermission } from '@atlas/identity';
import { ForbiddenError, NotFoundError } from '../domain/errors';

/**
 * jobs.md, "Permission requirements": Dispatcher/Admin/Owner full
 * read/write; Technician read/write limited to assigned Jobs
 * (`jobs:read_assigned`/`jobs:write_assigned`); Accountant read-only.
 * Two-layer check per docs/03-domain/permissions.md, mirroring
 * @atlas/properties's `requirePropertiesPermission`.
 */
export async function requireJobsPermission(
  tx: DatabaseClient,
  params: {
    organizationId: string;
    actorUserId: string;
    action: 'read' | 'read_assigned' | 'write' | 'write_assigned' | 'delete' | 'assign';
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
    resource: 'jobs',
    action: params.action,
  });
  if (!allowed) {
    throw new ForbiddenError();
  }
}
