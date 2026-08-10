import { and, eq, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';
import type { StockMovementReason } from '../domain/stock';

export type StockMovement = typeof schema.stockMovements.$inferSelect;

export async function insertStockMovement(
  tx: DatabaseClient,
  input: {
    organizationId: string;
    inventoryItemId: string;
    locationId: string;
    reason: StockMovementReason;
    quantityDelta: string;
    notes?: string | null | undefined;
    createdByUserId?: string | null | undefined;
  },
): Promise<StockMovement> {
  const [row] = await tx
    .insert(schema.stockMovements)
    .values({
      organizationId: input.organizationId,
      inventoryItemId: input.inventoryItemId,
      locationId: input.locationId,
      reason: input.reason,
      quantityDelta: input.quantityDelta,
      notes: input.notes ?? null,
      createdByUserId: input.createdByUserId ?? null,
    })
    .returning();
  if (!row) throw new Error('Failed to record Stock Movement.');
  return row;
}

/** inventory.md business rule 1: quantity on hand is always derived by summing `stock_movements` — the live SQL equivalent of `domain/stock.ts`'s `computeQuantityOnHand`. */
export async function getQuantityOnHand(
  tx: DatabaseClient,
  params: { inventoryItemId: string; locationId: string },
): Promise<number> {
  const [row] = await tx.execute<{ total: string | null }>(sql`
    SELECT COALESCE(SUM(quantity_delta), 0) AS total
    FROM inventory.stock_movements
    WHERE inventory_item_id = ${params.inventoryItemId}
      AND location_id = ${params.locationId}
  `);
  return Number(row?.total ?? 0);
}

/** Quantity on hand per location for one Inventory Item, across every location it has ever moved through — powers the per-location quantity columns on the Item detail view. */
export async function getQuantityOnHandByLocation(
  tx: DatabaseClient,
  inventoryItemId: string,
): Promise<{ locationId: string; quantityOnHand: number }[]> {
  const rows = await tx.execute<{ location_id: string; total: string }>(sql`
    SELECT location_id, COALESCE(SUM(quantity_delta), 0) AS total
    FROM inventory.stock_movements
    WHERE inventory_item_id = ${inventoryItemId}
    GROUP BY location_id
  `);
  return rows.map((r) => ({ locationId: r.location_id, quantityOnHand: Number(r.total) }));
}

export async function listStockMovementsForItem(
  tx: DatabaseClient,
  organizationId: string,
  inventoryItemId: string,
): Promise<StockMovement[]> {
  return tx
    .select()
    .from(schema.stockMovements)
    .where(
      and(
        eq(schema.stockMovements.organizationId, organizationId),
        eq(schema.stockMovements.inventoryItemId, inventoryItemId),
      ),
    )
    .orderBy(schema.stockMovements.createdAt);
}
