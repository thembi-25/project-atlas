import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from './org';
import { jobs } from './jobs';
import { assetTypes } from './properties';
import { users } from './identity';

/**
 * Inventory & Suppliers domain (Sprint 6) — see docs/03-domain/
 * inventory.md, docs/03-domain/suppliers.md, docs/06-modules/
 * inventory-prd.md, docs/06-modules/suppliers-prd.md,
 * docs/13-roadmap/sprint-6.md. Maps to two TypeScript packages
 * (@atlas/inventory, @atlas/suppliers — scaffolded separately since
 * Sprint 0) sharing one Postgres schema, per docs/04-database/
 * schema-overview.md's single "`inventory` schema" grouping — the same
 * two-packages/one-schema precedent as jobs.ts (@atlas/jobs,
 * @atlas/scheduling) and properties.ts (@atlas/properties, @atlas/assets).
 *
 * There is no `technician_profiles` table in this codebase (documented in
 * docs/03-domain/technicians.md as an optional extension, never built in
 * any prior sprint — confirmed absent from schema-overview.md's table
 * list and every prior migration). `inventory_locations.technician_
 * user_id` therefore references `identity.users` directly, exactly as
 * schema-overview.md's own column list names it, mirroring
 * `jobs.job_assignments.user_id`'s precedent of referencing `identity.
 * users` directly rather than a nonexistent intermediary table.
 */
export const inventorySchema = pgSchema('inventory');

export const inventoryLocationTypeEnum = inventorySchema.enum('inventory_location_type', [
  'warehouse',
  'truck',
]);

/**
 * stock_movements.reason — docs/03-domain/inventory.md Key attributes:
 * "an append-only ledger of every quantity change (received,
 * consumed_on_job, transferred, adjusted)."
 */
export const stockMovementReasonEnum = inventorySchema.enum('stock_movement_reason', [
  'received',
  'consumed_on_job',
  'transferred',
  'adjusted',
]);

/** suppliers.md, "State machines": `draft -> ordered -> received` (+ `cancelled`), a simple linear lifecycle. */
export const purchaseOrderStatusEnum = inventorySchema.enum('purchase_order_status', [
  'draft',
  'ordered',
  'received',
  'cancelled',
]);

/**
 * A trackable part/material — docs/03-domain/inventory.md. `lowStock
 * Threshold` is a deliberate, documented scope decision: inventory.md
 * business rule 4 says thresholds are "per Inventory Item per location,
 * configurable per Organization," but neither the PRD's Data
 * Requirements nor schema-overview.md lists a separate per-location
 * threshold table — a single per-Item threshold (applied uniformly
 * across that Item's locations) satisfies the documented low-stock
 * widget/alerting requirement without inventing an undocumented table,
 * mirroring Sprint 5's Credit Notes minimal-but-correct scoping
 * precedent (see docs/13-roadmap/SPRINT-5-COMPLETION-REPORT.md).
 */
export const inventoryItems = inventorySchema.table(
  'inventory_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`public.uuid_generate_v7()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    sku: text('sku').notNull(),
    description: text('description').notNull(),
    assetTypeId: uuid('asset_type_id').references(() => assetTypes.id),
    unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull().default('0'),
    defaultSellPrice: numeric('default_sell_price', { precision: 12, scale: 2 }),
    lowStockThreshold: numeric('low_stock_threshold', { precision: 12, scale: 2 }),
    isActive: boolean('is_active').notNull().default(true),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_inventory_items_org_sku')
      .on(table.organizationId, table.sku)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

/**
 * A warehouse or truck location that can hold stock —
 * docs/03-domain/inventory.md. `technicianUserId` is set only for
 * `type = 'truck'` (that truck's assigned Technician); enforced at the
 * application layer, not a CHECK constraint, since it depends on the
 * enum value in a way Postgres CHECK could express but which the
 * application layer already validates identically to every other
 * cross-field business rule in this codebase (e.g. `estimates.md`'s
 * status-dependent nullability rules).
 */
export const inventoryLocations = inventorySchema.table('inventory_locations', {
  id: uuid('id')
    .primaryKey()
    .default(sql`public.uuid_generate_v7()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  type: inventoryLocationTypeEnum('type').notNull(),
  name: text('name').notNull(),
  technicianUserId: uuid('technician_user_id').references(() => users.id),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Append-only quantity ledger — docs/03-domain/inventory.md business
 * rule 1: "Quantity on hand per location is always derived by summing
 * `stock_movements`, never stored as an independently editable field."
 * No `updated_at`/`deleted_at` — movements are never edited or deleted,
 * the same append-only shape as `jobs.job_status_history`.
 * `notes` is required at the application layer (not a DB CHECK) for
 * `reason = 'adjusted'` movements, per inventory.md's Edge Cases:
 * "reconciled via an `adjusted` stock movement with a required reason."
 */
export const stockMovements = inventorySchema.table('stock_movements', {
  id: uuid('id')
    .primaryKey()
    .default(sql`public.uuid_generate_v7()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  inventoryItemId: uuid('inventory_item_id')
    .notNull()
    .references(() => inventoryItems.id),
  locationId: uuid('location_id')
    .notNull()
    .references(() => inventoryLocations.id),
  reason: stockMovementReasonEnum('reason').notNull(),
  quantityDelta: numeric('quantity_delta', { precision: 12, scale: 2 }).notNull(),
  notes: text('notes'),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Job <-> Inventory Item consumption join — docs/03-domain/inventory.md.
 * `unitCostAtTime` is captured independently of the Inventory Item's
 * current `unit_cost` so a later cost change never retroactively alters
 * historical Job costing (business rule 3). `stockMovementId` links to
 * the `consumed_on_job` ledger row this consumption produced (created in
 * the same transaction), giving one-directional traceability without a
 * polymorphic reference column on `stock_movements` itself.
 */
export const jobParts = inventorySchema.table('job_parts', {
  id: uuid('id')
    .primaryKey()
    .default(sql`public.uuid_generate_v7()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  jobId: uuid('job_id')
    .notNull()
    .references(() => jobs.id),
  inventoryItemId: uuid('inventory_item_id')
    .notNull()
    .references(() => inventoryItems.id),
  stockMovementId: uuid('stock_movement_id').references(() => stockMovements.id),
  quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull(),
  unitCostAtTime: numeric('unit_cost_at_time', { precision: 12, scale: 2 }).notNull(),
  consumedByUserId: uuid('consumed_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A vendor the Organization purchases parts from —
 * docs/03-domain/suppliers.md. Launch-scope informational record; no
 * live catalog/pricing (Strategic Phase 3 Marketplace scope).
 */
export const suppliers = inventorySchema.table('suppliers', {
  id: uuid('id')
    .primaryKey()
    .default(sql`public.uuid_generate_v7()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  name: text('name').notNull(),
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  accountNumber: text('account_number'),
  notes: text('notes'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A basic, manual Purchase Order — docs/03-domain/suppliers.md.
 * `receivingLocationId` is not part of schema-overview.md's abbreviated
 * column list (that document intentionally "does not repeat full DDL")
 * but is required to know which `inventory_locations` row a `/receive`
 * action's `stock_movements` rows target; documented here and in the
 * Sprint 6 completion report as a deliberate, minimal addition.
 */
export const purchaseOrders = inventorySchema.table('purchase_orders', {
  id: uuid('id')
    .primaryKey()
    .default(sql`public.uuid_generate_v7()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  supplierId: uuid('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  receivingLocationId: uuid('receiving_location_id')
    .notNull()
    .references(() => inventoryLocations.id),
  status: purchaseOrderStatusEnum('status').notNull().default('draft'),
  notes: text('notes'),
  orderedAt: timestamp('ordered_at', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Purchase Order detail lines — docs/03-domain/suppliers.md Data
 * requirements: "line items." `quantityReceived` tracks partial receipt
 * (suppliers.md Edge Cases) independently of `quantityOrdered`, so a PO
 * can sit `ordered` (partially fulfilled) until every line is received.
 */
export const purchaseOrderLineItems = inventorySchema.table('purchase_order_line_items', {
  id: uuid('id')
    .primaryKey()
    .default(sql`public.uuid_generate_v7()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  purchaseOrderId: uuid('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.id),
  inventoryItemId: uuid('inventory_item_id')
    .notNull()
    .references(() => inventoryItems.id),
  quantityOrdered: numeric('quantity_ordered', { precision: 12, scale: 2 }).notNull(),
  quantityReceived: numeric('quantity_received', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
