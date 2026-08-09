import type { DatabaseClient } from '@atlas/database';
import { findActiveMembershipByOrgAndUser, hasPermission } from '@atlas/identity';
import { ForbiddenError, NotFoundError } from '../domain/errors';

/**
 * assets.md, "Permission requirements": "Same visibility rules as the
 * parent Property" — but Assets carries its own `assets` resource
 * Permission (distinct from `properties`), granted in lockstep with the
 * Property Permission set for every Role except Technician, who is
 * `properties:read`-only but `assets:write` (assets-prd.md §12: "Same as
 * parent Property — Technicians can create/update Assets on Properties
 * tied to their assigned Jobs" — see migrations/
 * 0011_properties_technician_assets_write.sql). Two-layer check per
 * docs/03-domain/permissions.md, mirroring @atlas/crm's
 * `requireCustomersPermission`.
 */
export async function requireAssetsPermission(
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
    resource: 'assets',
    action: params.action,
  });
  if (!allowed) {
    throw new ForbiddenError();
  }
}
