import { sql } from 'drizzle-orm';
import type { DatabaseClient } from '@atlas/database';

/**
 * Server-authoritative, race-free sequential numbering — same atomic-
 * UPSERT pattern as @atlas/jobs's `allocateJobNumber` (see that module's
 * comment for the full race-condition rationale). Estimate numbers are
 * allocated at creation time (no gap-free requirement — estimates.md).
 * Invoice numbers are allocated at *finalize* time instead — see
 * `packages/database/src/schema/financials.ts`'s comment on
 * `invoiceNumberCounters` for why (invoices.md business rule 4: gap-free
 * for finalized Invoices specifically).
 */
export async function allocateEstimateNumber(
  tx: DatabaseClient,
  organizationId: string,
): Promise<number> {
  await tx.execute(sql`
    INSERT INTO financials.estimate_number_counters (organization_id, next_number)
    VALUES (${organizationId}::uuid, 1)
    ON CONFLICT (organization_id) DO NOTHING
  `);
  const rows = await tx.execute<{ assigned_number: number }>(sql`
    UPDATE financials.estimate_number_counters
    SET next_number = next_number + 1
    WHERE organization_id = ${organizationId}::uuid
    RETURNING next_number - 1 AS assigned_number
  `);
  const assigned = rows[0]?.assigned_number;
  if (assigned === undefined) {
    throw new Error('Failed to allocate an Estimate number');
  }
  return assigned;
}

export async function allocateInvoiceNumber(
  tx: DatabaseClient,
  organizationId: string,
): Promise<number> {
  await tx.execute(sql`
    INSERT INTO financials.invoice_number_counters (organization_id, next_number)
    VALUES (${organizationId}::uuid, 1)
    ON CONFLICT (organization_id) DO NOTHING
  `);
  const rows = await tx.execute<{ assigned_number: number }>(sql`
    UPDATE financials.invoice_number_counters
    SET next_number = next_number + 1
    WHERE organization_id = ${organizationId}::uuid
    RETURNING next_number - 1 AS assigned_number
  `);
  const assigned = rows[0]?.assigned_number;
  if (assigned === undefined) {
    throw new Error('Failed to allocate an Invoice number');
  }
  return assigned;
}
