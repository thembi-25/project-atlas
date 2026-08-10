import { asc, eq } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type InvoiceLineItem = typeof schema.invoiceLineItems.$inferSelect;

export interface InvoiceLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sortOrder?: number | undefined;
}

export async function insertInvoiceLineItems(
  tx: DatabaseClient,
  organizationId: string,
  invoiceId: string,
  items: InvoiceLineItemInput[],
): Promise<InvoiceLineItem[]> {
  if (items.length === 0) return [];
  return tx
    .insert(schema.invoiceLineItems)
    .values(
      items.map((item, index) => ({
        organizationId,
        invoiceId,
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        lineTotal: String(item.lineTotal),
        sortOrder: item.sortOrder ?? index,
      })),
    )
    .returning();
}

export async function listInvoiceLineItems(
  tx: DatabaseClient,
  invoiceId: string,
): Promise<InvoiceLineItem[]> {
  return tx
    .select()
    .from(schema.invoiceLineItems)
    .where(eq(schema.invoiceLineItems.invoiceId, invoiceId))
    .orderBy(asc(schema.invoiceLineItems.sortOrder));
}

/** Replaces every line item on a draft Invoice — draft-only edit; immutable once finalized (invoices.md business rule 1). */
export async function replaceInvoiceLineItems(
  tx: DatabaseClient,
  organizationId: string,
  invoiceId: string,
  items: InvoiceLineItemInput[],
): Promise<InvoiceLineItem[]> {
  await tx.delete(schema.invoiceLineItems).where(eq(schema.invoiceLineItems.invoiceId, invoiceId));
  return insertInvoiceLineItems(tx, organizationId, invoiceId, items);
}
