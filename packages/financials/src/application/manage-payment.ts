import { withRequestContext, type DatabaseClient } from '@atlas/database';
import {
  listPaymentsForOrganization,
  type ListPaymentsResult,
  type PaymentCursor,
} from '../infrastructure/payments';
import type { PaymentStatus } from '../domain/lifecycle';
import { requireFinancialsPermission } from './authorize';

export interface ListPaymentsParams {
  organizationId: string;
  actorUserId: string;
  limit: number;
  cursor?: PaymentCursor | undefined;
  status?: PaymentStatus | undefined;
  invoiceId?: string | undefined;
}

/** payments.md §12: same `payments:read` Permission as every other Payments read — added Sprint 7 for `GET /api/v1/payments` and the CSV export route. */
export async function listPayments(db: DatabaseClient, params: ListPaymentsParams): Promise<ListPaymentsResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'payments',
      action: 'read',
    });
    return listPaymentsForOrganization(tx, params);
  });
}
