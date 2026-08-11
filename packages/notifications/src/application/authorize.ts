import type { DatabaseClient } from '@atlas/database';
import { findActiveMembershipByOrgAndUser, hasPermission } from '@atlas/identity';
import { listContactsByPortalUserId } from '@atlas/crm';
import { ForbiddenError, NotFoundError } from '../domain/errors';
import type { OwnerRef } from '../infrastructure/owner-ref';

/**
 * notifications-prd.md §12: "Each User/Contact manages only their own
 * preferences" — no RBAC Permission at all, scoped by identity. An actor
 * is either a staff User (an active Membership in the Organization) or a
 * Portal Contact (linked via `crm.contacts.portal_user_id` — see
 * `packages/crm/src/application/portal-auth.ts`). Mirrors
 * `notification_preferences`'s own `owner_type` discriminator exactly.
 */
export async function resolveOwnerRef(
  tx: DatabaseClient,
  params: { organizationId: string; actorUserId: string },
): Promise<OwnerRef> {
  const membership = await findActiveMembershipByOrgAndUser(tx, params.organizationId, params.actorUserId);
  if (membership) {
    return { ownerType: 'user', ownerUserId: params.actorUserId };
  }

  const contacts = await listContactsByPortalUserId(tx, params.actorUserId);
  const contact = contacts.find((c) => c.organizationId === params.organizationId);
  if (contact) {
    return { ownerType: 'contact', ownerContactId: contact.id };
  }

  throw new NotFoundError('Organization');
}

/**
 * notifications-prd.md §12: "Admin/Owner can view organization-wide
 * delivery-failure reports for operational troubleshooting" — reuses the
 * existing `organization:manage_settings` Permission (Owner/Admin-only),
 * matching the RLS policy in migration 0028 rather than inventing a new
 * `notifications` resource.
 */
export async function requireNotificationsAdminAccess(
  tx: DatabaseClient,
  params: { organizationId: string; actorUserId: string },
): Promise<void> {
  const allowed = await hasPermission(tx, {
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    resource: 'organization',
    action: 'manage_settings',
  });
  if (!allowed) {
    throw new ForbiddenError();
  }
}
