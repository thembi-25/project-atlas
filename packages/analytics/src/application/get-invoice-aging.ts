import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { describeStaleness, type Staleness } from '../domain/staleness';
import { queryInvoiceAging, type InvoiceAgingRow } from '../infrastructure/invoice-aging';
import { findLastRefreshedAt } from '../infrastructure/refresh-log';
import { requireAnalyticsAccess } from './authorize';

export interface GetInvoiceAgingParams {
  organizationId: string;
  actorUserId: string;
}

export interface GetInvoiceAgingResult extends Staleness {
  rows: InvoiceAgingRow[];
}

/** analytics-prd.md §7 "invoice-aging dashboard." */
export async function getInvoiceAging(
  db: DatabaseClient,
  params: GetInvoiceAgingParams,
): Promise<GetInvoiceAgingResult> {
  return withServiceContext(db, async (tx) => {
    await requireAnalyticsAccess(tx, params);
    const [rows, lastRefreshedAt] = await Promise.all([
      queryInvoiceAging(tx, params.organizationId),
      findLastRefreshedAt(tx, 'mv_invoice_aging'),
    ]);
    return { ...describeStaleness(lastRefreshedAt, new Date()), rows };
  });
}
