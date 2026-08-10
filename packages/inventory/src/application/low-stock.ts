import { sql } from 'drizzle-orm';
import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { requireInventoryPermission } from './authorize';

export interface LowStockRow {
  inventoryItemId: string;
  sku: string;
  description: string;
  locationId: string;
  locationName: string;
  quantityOnHand: number;
  lowStockThreshold: number;
}

/**
 * inventory-prd.md §13: "low-stock dashboard widget." inventory.md
 * business rule 4: threshold-based per Item, applied per Location (see
 * packages/database/src/schema/inventory.ts's comment on
 * `inventoryItems.lowStockThreshold` for the documented, deliberate
 * single-per-Item-threshold scoping). Notification delivery is
 * explicitly deferred — see docs/13-roadmap/sprint-6.md, "Scope
 * decisions"; this is the in-app computed query only.
 */
export async function listLowStockItems(
  db: DatabaseClient,
  params: { organizationId: string; actorUserId: string },
): Promise<LowStockRow[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'read' });
    const rows = await tx.execute<{
      inventory_item_id: string;
      sku: string;
      description: string;
      location_id: string;
      location_name: string;
      quantity_on_hand: string;
      low_stock_threshold: string;
    }>(sql`
      SELECT
        ii.id AS inventory_item_id,
        ii.sku,
        ii.description,
        il.id AS location_id,
        il.name AS location_name,
        COALESCE(SUM(sm.quantity_delta), 0) AS quantity_on_hand,
        ii.low_stock_threshold
      FROM inventory.inventory_items ii
      CROSS JOIN inventory.inventory_locations il
      LEFT JOIN inventory.stock_movements sm
        ON sm.inventory_item_id = ii.id AND sm.location_id = il.id
      WHERE ii.organization_id = ${params.organizationId}
        AND il.organization_id = ${params.organizationId}
        AND ii.deleted_at IS NULL
        AND il.deleted_at IS NULL
        AND ii.low_stock_threshold IS NOT NULL
      GROUP BY ii.id, ii.sku, ii.description, il.id, il.name, ii.low_stock_threshold
      HAVING COALESCE(SUM(sm.quantity_delta), 0) < ii.low_stock_threshold
      ORDER BY ii.sku
    `);
    return rows.map((r) => ({
      inventoryItemId: r.inventory_item_id,
      sku: r.sku,
      description: r.description,
      locationId: r.location_id,
      locationName: r.location_name,
      quantityOnHand: Number(r.quantity_on_hand),
      lowStockThreshold: Number(r.low_stock_threshold),
    }));
  });
}
