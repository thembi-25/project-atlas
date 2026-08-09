import type { DatabaseClient } from '@atlas/database';
import { findActiveMembershipByOrgAndUser, hasPermission } from '@atlas/identity';
import { ForbiddenError, NotFoundError } from '../domain/errors';

/**
 * Buildings and Rooms have no independent Permission (buildings.md,
 * rooms.md: "Inherits from Properties") — every check in this module,
 * including Building/Room mutations, uses the `properties` resource. See
 * docs/03-domain/properties.md, "Permission requirements": Dispatcher,
 * Admin, Owner get read/write; Technician is read-only (scoped to
 * assigned Jobs, not enforced this sprint — Jobs doesn't exist yet);
 * Accountant is read-only. Two-layer check per
 * docs/03-domain/permissions.md, mirroring @atlas/crm's
 * `requireCustomersPermission`.
 */
export async function requirePropertiesPermission(
  tx: DatabaseClient,
  params: { organizationId: string; actorUserId: string; action: 'read' | 'write' | 'delete' },
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
    resource: 'properties',
    action: params.action,
  });
  if (!allowed) {
    throw new ForbiddenError();
  }
}
