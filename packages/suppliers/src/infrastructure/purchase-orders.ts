import { and, eq, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';
import type { PurchaseOrderStatus } from '../domain/lifecycle';

export type PurchaseOrder = typeof schema.purchaseOrders.$inferSelect;

export async function insertPurchaseOrder(
  tx: DatabaseClient,
  input: {
    organizationId: string;
    supplierId: string;
    receivingLocationId: string;
    notes?: string | null | undefined;
    createdByUserId?: string | null | undefined;
  },
): Promise<PurchaseOrder> {
  const [row] = await tx
    .insert(schema.purchaseOrders)
    .values({
      organizationId: input.organizationId,
      supplierId: input.supplierId,
      receivingLocationId: input.receivingLocationId,
      notes: input.notes ?? null,
      createdByUserId: input.createdByUserId ?? null,
    })
    .returning();
  if (!row) throw new Error('Failed to create Purchase Order.');
  return row;
}

export async function findPurchaseOrderById(
  tx: DatabaseClient,
  id: string,
): Promise<PurchaseOrder | undefined> {
  const [row] = await tx
    .select()
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.id, id))
    .limit(1);
  return row;
}

export async function updatePurchaseOrderStatus(
  tx: DatabaseClient,
  id: string,
  fields: {
    status: PurchaseOrderStatus;
    orderedAt?: Date | undefined;
    receivedAt?: Date | undefined;
  },
): Promise<PurchaseOrder> {
  const [row] = await tx
    .update(schema.purchaseOrders)
    .set({
      status: fields.status,
      ...(fields.orderedAt !== undefined ? { orderedAt: fields.orderedAt } : {}),
      ...(fields.receivedAt !== undefined ? { receivedAt: fields.receivedAt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.purchaseOrders.id, id))
    .returning();
  if (!row) throw new Error('Failed to update Purchase Order.');
  return row;
}

export interface UpdatePurchaseOrderDraftFields {
  supplierId?: string | undefined;
  receivingLocationId?: string | undefined;
  notes?: string | null | undefined;
}

export async function updatePurchaseOrderDraftFields(
  tx: DatabaseClient,
  id: string,
  fields: UpdatePurchaseOrderDraftFields,
): Promise<PurchaseOrder> {
  const [row] = await tx
    .update(schema.purchaseOrders)
    .set({
      ...(fields.supplierId !== undefined ? { supplierId: fields.supplierId } : {}),
      ...(fields.receivingLocationId !== undefined
        ? { receivingLocationId: fields.receivingLocationId }
        : {}),
      ...(fields.notes !== undefined ? { notes: fields.notes } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.purchaseOrders.id, id))
    .returning();
  if (!row) throw new Error('Failed to update Purchase Order.');
  return row;
}

function purchaseOrderCursorCondition(
  direction: 'asc' | 'desc',
  cursor: { sortValue: string; id: string } | undefined,
) {
  if (!cursor) return undefined;
  const op = direction === 'desc' ? sql`<` : sql`>`;
  return sql`(${schema.purchaseOrders.createdAt}, ${schema.purchaseOrders.id}) ${op} (${new Date(cursor.sortValue)}::timestamptz, ${cursor.id}::uuid)`;
}

export interface ListPurchaseOrdersParams {
  organizationId: string;
  limit: number;
  cursor?: { sortValue: string; id: string } | undefined;
  sortDirection: 'asc' | 'desc';
  status?: PurchaseOrderStatus | undefined;
}

export interface ListPurchaseOrdersResult {
  rows: PurchaseOrder[];
  hasMore: boolean;
}

export async function listPurchaseOrdersForOrganization(
  tx: DatabaseClient,
  params: ListPurchaseOrdersParams,
): Promise<ListPurchaseOrdersResult> {
  const conditions = [eq(schema.purchaseOrders.organizationId, params.organizationId)];
  if (params.status) {
    conditions.push(eq(schema.purchaseOrders.status, params.status));
  }
  const cursorCondition = purchaseOrderCursorCondition(params.sortDirection, params.cursor);
  if (cursorCondition) conditions.push(cursorCondition);

  const orderExpr =
    params.sortDirection === 'desc'
      ? sql`${schema.purchaseOrders.createdAt} DESC, ${schema.purchaseOrders.id} DESC`
      : sql`${schema.purchaseOrders.createdAt} ASC, ${schema.purchaseOrders.id} ASC`;

  const rows = await tx
    .select()
    .from(schema.purchaseOrders)
    .where(and(...conditions))
    .orderBy(orderExpr)
    .limit(params.limit + 1);

  const hasMore = rows.length > params.limit;
  return { rows: hasMore ? rows.slice(0, params.limit) : rows, hasMore };
}
