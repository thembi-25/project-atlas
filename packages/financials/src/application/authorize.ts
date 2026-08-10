import type { DatabaseClient } from '@atlas/database';
import { findActiveMembershipByOrgAndUser, hasPermission } from '@atlas/identity';
import { ForbiddenError, NotFoundError } from '../domain/errors';

export type FinancialsResource = 'estimates' | 'invoices' | 'payments';

/**
 * estimates.md/invoices.md/payments.md, "Permission requirements" —
 * mirrors @atlas/jobs's `requireJobsPermission` two-layer check exactly.
 */
export async function requireFinancialsPermission(
  tx: DatabaseClient,
  params: {
    organizationId: string;
    actorUserId: string;
    resource: FinancialsResource;
    action: string;
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
    resource: params.resource,
    action: params.action,
  });
  if (!allowed) {
    throw new ForbiddenError();
  }
}
