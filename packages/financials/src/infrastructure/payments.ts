import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';
import type { PaymentStatus } from '../domain/lifecycle';

export type Payment = typeof schema.payments.$inferSelect;
export type PaymentMethod = Payment['method'];
export type PaymentInitiatedBy = Payment['initiatedBy'];

export interface CreatePaymentInput {
  organizationId: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  processor?: string | null | undefined;
  processorReferenceId?: string | null | undefined;
  cardLast4?: string | null | undefined;
  cardBrand?: string | null | undefined;
  initiatedBy?: PaymentInitiatedBy | undefined;
  capturedByUserId?: string | null | undefined;
  refundOfPaymentId?: string | null | undefined;
  idempotencyKey: string;
  status?: PaymentStatus | undefined;
  completedAt?: Date | null | undefined;
}

export async function insertPayment(
  tx: DatabaseClient,
  input: CreatePaymentInput,
): Promise<Payment> {
  const [payment] = await tx
    .insert(schema.payments)
    .values({
      organizationId: input.organizationId,
      invoiceId: input.invoiceId,
      amount: String(input.amount),
      method: input.method,
      status: input.status ?? 'pending',
      processor: input.processor ?? null,
      processorReferenceId: input.processorReferenceId ?? null,
      cardLast4: input.cardLast4 ?? null,
      cardBrand: input.cardBrand ?? null,
      initiatedBy: input.initiatedBy ?? 'staff',
      capturedByUserId: input.capturedByUserId ?? null,
      refundOfPaymentId: input.refundOfPaymentId ?? null,
      idempotencyKey: input.idempotencyKey,
      completedAt: input.completedAt ?? null,
    })
    .returning();
  if (!payment) throw new Error('Failed to insert payment');
  return payment;
}

export async function findPaymentById(
  tx: DatabaseClient,
  paymentId: string,
): Promise<Payment | undefined> {
  const [payment] = await tx
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.id, paymentId))
    .limit(1);
  return payment;
}

export async function findPaymentByIdempotencyKey(
  tx: DatabaseClient,
  idempotencyKey: string,
): Promise<Payment | undefined> {
  const [payment] = await tx
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.idempotencyKey, idempotencyKey))
    .limit(1);
  return payment;
}

export async function findPaymentByProcessorReferenceId(
  tx: DatabaseClient,
  processorReferenceId: string,
): Promise<Payment | undefined> {
  const [payment] = await tx
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.processorReferenceId, processorReferenceId))
    .limit(1);
  return payment;
}

export interface SetPaymentStatusInput {
  status: PaymentStatus;
  completedAt?: Date | null | undefined;
  failedAt?: Date | null | undefined;
  refundedAt?: Date | null | undefined;
}

export async function setPaymentStatus(
  tx: DatabaseClient,
  paymentId: string,
  input: SetPaymentStatusInput,
): Promise<Payment | undefined> {
  const [payment] = await tx
    .update(schema.payments)
    .set({
      status: input.status,
      ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
      ...(input.failedAt !== undefined ? { failedAt: input.failedAt } : {}),
      ...(input.refundedAt !== undefined ? { refundedAt: input.refundedAt } : {}),
    })
    .where(eq(schema.payments.id, paymentId))
    .returning();
  return payment;
}

export async function listPaymentsForInvoice(
  tx: DatabaseClient,
  invoiceId: string,
): Promise<Payment[]> {
  return tx
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.invoiceId, invoiceId))
    .orderBy(asc(schema.payments.createdAt));
}

/** payments.md: `amount_paid` sums non-*failed* Payments (includes negative refund rows). */
export async function listNonFailedPaymentsForInvoice(
  tx: DatabaseClient,
  invoiceId: string,
): Promise<Payment[]> {
  return tx
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.invoiceId, invoiceId), ne(schema.payments.status, 'failed')));
}

export interface PaymentCursor {
  sortValue: string;
  id: string;
}

export interface ListPaymentsParams {
  organizationId: string;
  limit: number;
  cursor?: PaymentCursor | undefined;
  status?: PaymentStatus | undefined;
  invoiceId?: string | undefined;
}

export interface ListPaymentsResult {
  rows: Payment[];
  hasMore: boolean;
}

/**
 * Organization-wide Payments listing — added Sprint 7 for CSV export
 * (reporting-prd.md §7: "any core entity list ... can be exported with
 * the same filters available in its list view"); no prior sprint needed
 * this, since Payments were previously only ever listed per-Invoice (see
 * `listPaymentsForInvoice` above). Backs both
 * `apps/web/app/api/v1/payments/route.ts` (GET, new this sprint) and the
 * CSV export route.
 */
export async function listPaymentsForOrganization(
  tx: DatabaseClient,
  params: ListPaymentsParams,
): Promise<ListPaymentsResult> {
  const conditions = [eq(schema.payments.organizationId, params.organizationId)];
  if (params.status) conditions.push(eq(schema.payments.status, params.status));
  if (params.invoiceId) conditions.push(eq(schema.payments.invoiceId, params.invoiceId));
  if (params.cursor) {
    conditions.push(
      sql`(${schema.payments.createdAt}, ${schema.payments.id}) < (${new Date(params.cursor.sortValue)}::timestamptz, ${params.cursor.id}::uuid)`,
    );
  }

  const rows = await tx
    .select()
    .from(schema.payments)
    .where(and(...conditions))
    .orderBy(sql`${schema.payments.createdAt} DESC, ${schema.payments.id} DESC`)
    .limit(params.limit + 1);

  const hasMore = rows.length > params.limit;
  return { rows: hasMore ? rows.slice(0, params.limit) : rows, hasMore };
}
