import { and, eq, isNull, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type Supplier = typeof schema.suppliers.$inferSelect;

export type SupplierSortField = 'created_at' | 'name';
export type SortDirection = 'asc' | 'desc';

export interface SupplierCursor {
  sortValue: string;
  id: string;
}

export async function insertSupplier(
  tx: DatabaseClient,
  input: {
    organizationId: string;
    name: string;
    contactName?: string | null | undefined;
    email?: string | null | undefined;
    phone?: string | null | undefined;
    accountNumber?: string | null | undefined;
    notes?: string | null | undefined;
  },
): Promise<Supplier> {
  const [row] = await tx
    .insert(schema.suppliers)
    .values({
      organizationId: input.organizationId,
      name: input.name,
      contactName: input.contactName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      accountNumber: input.accountNumber ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  if (!row) throw new Error('Failed to create Supplier.');
  return row;
}

export async function findSupplierById(
  tx: DatabaseClient,
  id: string,
): Promise<Supplier | undefined> {
  const [row] = await tx
    .select()
    .from(schema.suppliers)
    .where(eq(schema.suppliers.id, id))
    .limit(1);
  return row;
}

export interface UpdateSupplierFields {
  name?: string | undefined;
  contactName?: string | null | undefined;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  accountNumber?: string | null | undefined;
  notes?: string | null | undefined;
}

export async function updateSupplierFields(
  tx: DatabaseClient,
  id: string,
  fields: UpdateSupplierFields,
): Promise<Supplier> {
  const [row] = await tx
    .update(schema.suppliers)
    .set({
      ...(fields.name !== undefined ? { name: fields.name } : {}),
      ...(fields.contactName !== undefined ? { contactName: fields.contactName } : {}),
      ...(fields.email !== undefined ? { email: fields.email } : {}),
      ...(fields.phone !== undefined ? { phone: fields.phone } : {}),
      ...(fields.accountNumber !== undefined ? { accountNumber: fields.accountNumber } : {}),
      ...(fields.notes !== undefined ? { notes: fields.notes } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.suppliers.id, id))
    .returning();
  if (!row) throw new Error('Failed to update Supplier.');
  return row;
}

export async function setSupplierDeletedAt(tx: DatabaseClient, id: string): Promise<Supplier> {
  const [row] = await tx
    .update(schema.suppliers)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.suppliers.id, id))
    .returning();
  if (!row) throw new Error('Failed to delete Supplier.');
  return row;
}

function supplierCursorCondition(
  sortField: SupplierSortField,
  direction: SortDirection,
  cursor: SupplierCursor | undefined,
) {
  if (!cursor) return undefined;
  const op = direction === 'desc' ? sql`<` : sql`>`;
  if (sortField === 'created_at') {
    return sql`(${schema.suppliers.createdAt}, ${schema.suppliers.id}) ${op} (${new Date(cursor.sortValue)}::timestamptz, ${cursor.id}::uuid)`;
  }
  return sql`(${schema.suppliers.name}, ${schema.suppliers.id}) ${op} (${cursor.sortValue}::text, ${cursor.id}::uuid)`;
}

export interface ListSuppliersParams {
  organizationId: string;
  limit: number;
  cursor?: SupplierCursor | undefined;
  sortField: SupplierSortField;
  sortDirection: SortDirection;
}

export interface ListSuppliersResult {
  rows: Supplier[];
  hasMore: boolean;
}

export async function listSuppliersForOrganization(
  tx: DatabaseClient,
  params: ListSuppliersParams,
): Promise<ListSuppliersResult> {
  const conditions = [
    eq(schema.suppliers.organizationId, params.organizationId),
    isNull(schema.suppliers.deletedAt),
  ];
  const cursorCondition = supplierCursorCondition(
    params.sortField,
    params.sortDirection,
    params.cursor,
  );
  if (cursorCondition) conditions.push(cursorCondition);

  const sortColumn =
    params.sortField === 'created_at' ? schema.suppliers.createdAt : schema.suppliers.name;
  const orderExpr =
    params.sortDirection === 'desc'
      ? sql`${sortColumn} DESC, ${schema.suppliers.id} DESC`
      : sql`${sortColumn} ASC, ${schema.suppliers.id} ASC`;

  const rows = await tx
    .select()
    .from(schema.suppliers)
    .where(and(...conditions))
    .orderBy(orderExpr)
    .limit(params.limit + 1);

  const hasMore = rows.length > params.limit;
  return { rows: hasMore ? rows.slice(0, params.limit) : rows, hasMore };
}
