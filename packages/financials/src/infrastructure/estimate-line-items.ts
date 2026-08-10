import { asc, eq } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type EstimateLineItem = typeof schema.estimateLineItems.$inferSelect;

export interface EstimateLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sortOrder?: number | undefined;
}

export async function insertEstimateLineItems(
  tx: DatabaseClient,
  organizationId: string,
  estimateId: string,
  items: EstimateLineItemInput[],
): Promise<EstimateLineItem[]> {
  if (items.length === 0) return [];
  return tx
    .insert(schema.estimateLineItems)
    .values(
      items.map((item, index) => ({
        organizationId,
        estimateId,
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        lineTotal: String(item.lineTotal),
        sortOrder: item.sortOrder ?? index,
      })),
    )
    .returning();
}

export async function listEstimateLineItems(
  tx: DatabaseClient,
  estimateId: string,
): Promise<EstimateLineItem[]> {
  return tx
    .select()
    .from(schema.estimateLineItems)
    .where(eq(schema.estimateLineItems.estimateId, estimateId))
    .orderBy(asc(schema.estimateLineItems.sortOrder));
}

/** Replaces every line item on a draft Estimate — draft-only edit, per estimates.md business rule 2 (immutable once sent). */
export async function replaceEstimateLineItems(
  tx: DatabaseClient,
  organizationId: string,
  estimateId: string,
  items: EstimateLineItemInput[],
): Promise<EstimateLineItem[]> {
  await tx
    .delete(schema.estimateLineItems)
    .where(eq(schema.estimateLineItems.estimateId, estimateId));
  return insertEstimateLineItems(tx, organizationId, estimateId, items);
}
