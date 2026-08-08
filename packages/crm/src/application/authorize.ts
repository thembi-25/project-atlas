import type { DatabaseClient } from '@atlas/database';
import { findActiveMembershipByOrgAndUser, hasPermission } from '@atlas/identity';
import { ForbiddenError, NotFoundError } from '../domain/errors';

/**
 * docs/03-domain/contacts.md, "Permission requirements": Contacts have no
 * independent Permission — they inherit the `customers` Permission set.
 * Two-layer check per docs/03-domain/permissions.md: an actor with no
 * active Membership at all in the Organization gets `NotFoundError`
 * (cross-tenant masking, docs/05-api/authorization.md's "resource outside
 * caller's tenant" case); an actor who *is* a member but lacks the
 * specific Permission gets `ForbiddenError` (that same document's
 * "insufficient permission" case — a Technician requesting an org-wide
 * report is the given example, and it is 403, not 404).
 */
export async function requireCustomersPermission(
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
    resource: 'customers',
    action: params.action,
  });
  if (!allowed) {
    throw new ForbiddenError();
  }
}
