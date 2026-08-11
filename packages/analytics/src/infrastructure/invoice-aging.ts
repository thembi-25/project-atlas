import { sql } from 'drizzle-orm';
import type { DatabaseClient } from '@atlas/database';

export interface InvoiceAgingRow {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  status: string;
  total: string;
  dueDate: string | null;
  amountPaid: string;
  balanceDue: string;
  daysOverdue: number;
}

type RawRow = {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  status: string;
  total: string;
  due_date: string | null;
  amount_paid: string;
  balance_due: string;
  days_overdue: number;
};

/** Queries `analytics.mv_invoice_aging` (migration 0029) — always Organization-scoped. */
export async function queryInvoiceAging(
  tx: DatabaseClient,
  organizationId: string,
): Promise<InvoiceAgingRow[]> {
  const rows = await tx.execute<RawRow>(sql`
    SELECT invoice_id, invoice_number, customer_id, status, total, due_date, amount_paid, balance_due, days_overdue
    FROM analytics.mv_invoice_aging
    WHERE organization_id = ${organizationId}::uuid
    ORDER BY days_overdue DESC, due_date ASC
  `);
  return rows.map((row) => ({
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    status: row.status,
    total: row.total,
    dueDate: row.due_date,
    amountPaid: row.amount_paid,
    balanceDue: row.balance_due,
    daysOverdue: Number(row.days_overdue),
  }));
}
