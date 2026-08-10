import { and, eq, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';
import type { InvoiceStatus } from '../domain/lifecycle';

export type Invoice = typeof schema.invoices.$inferSelect;

export interface CreateInvoiceInput {
  organizationId: string;
  jobId: string;
  estimateId?: string | null | undefined;
  customerId: string;
  isDeposit?: boolean | undefined;
  subtotal: number;
  taxTotal: number;
  total: number;
  dueDate?: Date | null | undefined;
}

export async function insertInvoice(
  tx: DatabaseClient,
  input: CreateInvoiceInput,
): Promise<Invoice> {
  const [invoice] = await tx
    .insert(schema.invoices)
    .values({
      organizationId: input.organizationId,
      jobId: input.jobId,
      estimateId: input.estimateId ?? null,
      customerId: input.customerId,
      isDeposit: input.isDeposit ?? false,
      subtotal: String(input.subtotal),
      taxTotal: String(input.taxTotal),
      total: String(input.total),
      dueDate: input.dueDate ?? null,
    })
    .returning();
  if (!invoice) throw new Error('Failed to insert invoice');
  return invoice;
}

export async function findInvoiceById(
  tx: DatabaseClient,
  invoiceId: string,
): Promise<Invoice | undefined> {
  const [invoice] = await tx
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.id, invoiceId))
    .limit(1);
  return invoice;
}

export interface UpdateInvoiceTotalsInput {
  subtotal: number;
  taxTotal: number;
  total: number;
}

export async function updateInvoiceTotals(
  tx: DatabaseClient,
  invoiceId: string,
  input: UpdateInvoiceTotalsInput,
): Promise<Invoice | undefined> {
  const [invoice] = await tx
    .update(schema.invoices)
    .set({
      subtotal: String(input.subtotal),
      taxTotal: String(input.taxTotal),
      total: String(input.total),
      updatedAt: new Date(),
    })
    .where(eq(schema.invoices.id, invoiceId))
    .returning();
  return invoice;
}

export interface SetInvoiceStatusInput {
  status: InvoiceStatus;
  invoiceNumber?: number | undefined;
  finalizedAt?: Date | null | undefined;
  sentAt?: Date | null | undefined;
  voidedAt?: Date | null | undefined;
  voidReason?: string | null | undefined;
}

export async function setInvoiceStatus(
  tx: DatabaseClient,
  invoiceId: string,
  input: SetInvoiceStatusInput,
): Promise<Invoice | undefined> {
  const [invoice] = await tx
    .update(schema.invoices)
    .set({
      status: input.status,
      ...(input.invoiceNumber !== undefined ? { invoiceNumber: input.invoiceNumber } : {}),
      ...(input.finalizedAt !== undefined ? { finalizedAt: input.finalizedAt } : {}),
      ...(input.sentAt !== undefined ? { sentAt: input.sentAt } : {}),
      ...(input.voidedAt !== undefined ? { voidedAt: input.voidedAt } : {}),
      ...(input.voidReason !== undefined ? { voidReason: input.voidReason } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.invoices.id, invoiceId))
    .returning();
  return invoice;
}

export type InvoiceSortField = 'created_at' | 'invoice_number';
export type SortDirection = 'asc' | 'desc';

export interface InvoiceCursor {
  sortValue: string;
  id: string;
}

export interface ListInvoicesParams {
  organizationId: string;
  limit: number;
  cursor?: InvoiceCursor | undefined;
  sortField: InvoiceSortField;
  sortDirection: SortDirection;
  status?: InvoiceStatus | undefined;
  jobId?: string | undefined;
  customerId?: string | undefined;
}

export interface ListInvoicesResult {
  rows: Invoice[];
  hasMore: boolean;
}

function invoiceCursorCondition(
  sortField: InvoiceSortField,
  direction: SortDirection,
  cursor: InvoiceCursor | undefined,
) {
  if (!cursor) return undefined;
  const op = direction === 'desc' ? sql`<` : sql`>`;
  if (sortField === 'created_at') {
    return sql`(${schema.invoices.createdAt}, ${schema.invoices.id}) ${op} (${new Date(cursor.sortValue)}::timestamptz, ${cursor.id}::uuid)`;
  }
  return sql`(${schema.invoices.invoiceNumber}, ${schema.invoices.id}) ${op} (${Number(cursor.sortValue)}::integer, ${cursor.id}::uuid)`;
}

export async function listInvoicesForOrganization(
  tx: DatabaseClient,
  params: ListInvoicesParams,
): Promise<ListInvoicesResult> {
  const conditions = [eq(schema.invoices.organizationId, params.organizationId)];
  if (params.status) conditions.push(eq(schema.invoices.status, params.status));
  if (params.jobId) conditions.push(eq(schema.invoices.jobId, params.jobId));
  if (params.customerId) conditions.push(eq(schema.invoices.customerId, params.customerId));
  const cursorCondition = invoiceCursorCondition(
    params.sortField,
    params.sortDirection,
    params.cursor,
  );
  if (cursorCondition) conditions.push(cursorCondition);

  const sortColumn =
    params.sortField === 'created_at' ? schema.invoices.createdAt : schema.invoices.invoiceNumber;
  const orderExpr =
    params.sortDirection === 'desc'
      ? sql`${sortColumn} DESC, ${schema.invoices.id} DESC`
      : sql`${sortColumn} ASC, ${schema.invoices.id} ASC`;

  const rows = await tx
    .select()
    .from(schema.invoices)
    .where(and(...conditions))
    .orderBy(orderExpr)
    .limit(params.limit + 1);

  const hasMore = rows.length > params.limit;
  return { rows: hasMore ? rows.slice(0, params.limit) : rows, hasMore };
}
