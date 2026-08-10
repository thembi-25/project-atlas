import { and, eq, isNull, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type InventoryItem = typeof schema.inventoryItems.$inferSelect;

export type InventoryItemSortField = 'created_at' | 'sku';
export type SortDirection = 'asc' | 'desc';

export interface InventoryItemCursor {
  sortValue: string;
  id: string;
}

export async function insertInventoryItem(
  tx: DatabaseClient,
  input: {
    organizationId: string;
    sku: string;
    description: string;
    assetTypeId?: string | null | undefined;
    unitCost: string;
    defaultSellPrice?: string | null | undefined;
    lowStockThreshold?: string | null | undefined;
  },
): Promise<InventoryItem> {
  const [row] = await tx
    .insert(schema.inventoryItems)
    .values({
      organizationId: input.organizationId,
      sku: input.sku,
      description: input.description,
      assetTypeId: input.assetTypeId ?? null,
      unitCost: input.unitCost,
      defaultSellPrice: input.defaultSellPrice ?? null,
      lowStockThreshold: input.lowStockThreshold ?? null,
    })
    .returning();
  if (!row) throw new Error('Failed to create Inventory Item.');
  return row;
}

export async function findInventoryItemById(
  tx: DatabaseClient,
  id: string,
): Promise<InventoryItem | undefined> {
  const [row] = await tx
    .select()
    .from(schema.inventoryItems)
    .where(eq(schema.inventoryItems.id, id))
    .limit(1);
  return row;
}

export interface UpdateInventoryItemFields {
  description?: string | undefined;
  assetTypeId?: string | null | undefined;
  unitCost?: string | undefined;
  defaultSellPrice?: string | null | undefined;
  lowStockThreshold?: string | null | undefined;
  isActive?: boolean | undefined;
}

export async function updateInventoryItemFields(
  tx: DatabaseClient,
  id: string,
  fields: UpdateInventoryItemFields,
): Promise<InventoryItem> {
  const [row] = await tx
    .update(schema.inventoryItems)
    .set({
      ...(fields.description !== undefined ? { description: fields.description } : {}),
      ...(fields.assetTypeId !== undefined ? { assetTypeId: fields.assetTypeId } : {}),
      ...(fields.unitCost !== undefined ? { unitCost: fields.unitCost } : {}),
      ...(fields.defaultSellPrice !== undefined
        ? { defaultSellPrice: fields.defaultSellPrice }
        : {}),
      ...(fields.lowStockThreshold !== undefined
        ? { lowStockThreshold: fields.lowStockThreshold }
        : {}),
      ...(fields.isActive !== undefined ? { isActive: fields.isActive } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.inventoryItems.id, id))
    .returning();
  if (!row) throw new Error('Failed to update Inventory Item.');
  return row;
}

export async function setInventoryItemDeletedAt(
  tx: DatabaseClient,
  id: string,
): Promise<InventoryItem> {
  const [row] = await tx
    .update(schema.inventoryItems)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.inventoryItems.id, id))
    .returning();
  if (!row) throw new Error('Failed to delete Inventory Item.');
  return row;
}

function itemCursorCondition(
  sortField: InventoryItemSortField,
  direction: SortDirection,
  cursor: InventoryItemCursor | undefined,
) {
  if (!cursor) return undefined;
  const op = direction === 'desc' ? sql`<` : sql`>`;
  if (sortField === 'created_at') {
    return sql`(${schema.inventoryItems.createdAt}, ${schema.inventoryItems.id}) ${op} (${new Date(cursor.sortValue)}::timestamptz, ${cursor.id}::uuid)`;
  }
  return sql`(${schema.inventoryItems.sku}, ${schema.inventoryItems.id}) ${op} (${cursor.sortValue}::text, ${cursor.id}::uuid)`;
}

export interface ListInventoryItemsParams {
  organizationId: string;
  limit: number;
  cursor?: InventoryItemCursor | undefined;
  sortField: InventoryItemSortField;
  sortDirection: SortDirection;
}

export interface ListInventoryItemsResult {
  rows: InventoryItem[];
  hasMore: boolean;
}

/** Cursor-paginated, tenant-scoped Inventory Item listing — docs/05-api/pagination.md. */
export async function listInventoryItemsForOrganization(
  tx: DatabaseClient,
  params: ListInventoryItemsParams,
): Promise<ListInventoryItemsResult> {
  const conditions = [
    eq(schema.inventoryItems.organizationId, params.organizationId),
    isNull(schema.inventoryItems.deletedAt),
  ];
  const cursorCondition = itemCursorCondition(
    params.sortField,
    params.sortDirection,
    params.cursor,
  );
  if (cursorCondition) conditions.push(cursorCondition);

  const sortColumn =
    params.sortField === 'created_at' ? schema.inventoryItems.createdAt : schema.inventoryItems.sku;
  const orderExpr =
    params.sortDirection === 'desc'
      ? sql`${sortColumn} DESC, ${schema.inventoryItems.id} DESC`
      : sql`${sortColumn} ASC, ${schema.inventoryItems.id} ASC`;

  const rows = await tx
    .select()
    .from(schema.inventoryItems)
    .where(and(...conditions))
    .orderBy(orderExpr)
    .limit(params.limit + 1);

  const hasMore = rows.length > params.limit;
  return { rows: hasMore ? rows.slice(0, params.limit) : rows, hasMore };
}
