import { sql } from 'drizzle-orm';
import type { DatabaseClient } from '@atlas/database';

export interface RevenueByPeriodRow {
  period: string;
  totalRevenue: string;
  paymentCount: number;
}

type RawRow = {
  period: string;
  total_revenue: string;
  payment_count: string;
};

/** Queries `analytics.mv_revenue_by_period` (migration 0029) — always Organization-scoped, never client-controlled beyond that. */
export async function queryRevenueByPeriod(
  tx: DatabaseClient,
  organizationId: string,
): Promise<RevenueByPeriodRow[]> {
  const rows = await tx.execute<RawRow>(sql`
    SELECT period, total_revenue, payment_count
    FROM analytics.mv_revenue_by_period
    WHERE organization_id = ${organizationId}::uuid
    ORDER BY period ASC
  `);
  return rows.map((row) => ({
    period: row.period,
    totalRevenue: row.total_revenue,
    paymentCount: Number(row.payment_count),
  }));
}
