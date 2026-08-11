import { withRequestContext, type DatabaseClient } from '@atlas/database';
import {
  listNotificationsForOrganization,
  listNotificationsForRecipient,
  type ListNotificationsResult,
} from '../infrastructure/notifications-log';
import { requireNotificationsAdminAccess, resolveOwnerRef } from './authorize';

export interface ListMyNotificationsParams {
  organizationId: string;
  actorUserId: string;
  limit: number;
  cursor?: { sortValue: string; id: string } | undefined;
}

/** notifications-prd.md §13: "in-app notification bell/center for staff" — extends to Portal Contacts identically. */
export async function listMyNotifications(
  db: DatabaseClient,
  params: ListMyNotificationsParams,
): Promise<ListNotificationsResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    const owner = await resolveOwnerRef(tx, params);
    const recipient =
      owner.ownerType === 'user'
        ? ({ type: 'user' as const, userId: owner.ownerUserId })
        : ({ type: 'contact' as const, contactId: owner.ownerContactId });
    return listNotificationsForRecipient(tx, {
      organizationId: params.organizationId,
      recipient,
      limit: params.limit,
      cursor: params.cursor,
    });
  });
}

export interface ListOrganizationNotificationsParams {
  organizationId: string;
  actorUserId: string;
  limit: number;
  cursor?: { sortValue: string; id: string } | undefined;
  failedOnly?: boolean | undefined;
}

/** notifications-prd.md §12: Admin/Owner org-wide delivery-failure report. */
export async function listOrganizationNotifications(
  db: DatabaseClient,
  params: ListOrganizationNotificationsParams,
): Promise<ListNotificationsResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireNotificationsAdminAccess(tx, params);
    return listNotificationsForOrganization(tx, {
      organizationId: params.organizationId,
      limit: params.limit,
      cursor: params.cursor,
      failedOnly: params.failedOnly,
    });
  });
}
