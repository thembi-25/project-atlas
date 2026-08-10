import { and, eq, isNull, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';
import type { EstimateStatus } from '../domain/lifecycle';

export type Estimate = typeof schema.estimates.$inferSelect;

export interface CreateEstimateInput {
  organizationId: string;
  estimateNumber: number;
  jobId: string;
  customerId: string;
  contactId?: string | null | undefined;
  validUntil?: Date | null | undefined;
  subtotal: number;
  taxTotal: number;
  total: number;
  supersedesEstimateId?: string | null | undefined;
}

export async function insertEstimate(
  tx: DatabaseClient,
  input: CreateEstimateInput,
): Promise<Estimate> {
  const [estimate] = await tx
    .insert(schema.estimates)
    .values({
      organizationId: input.organizationId,
      estimateNumber: input.estimateNumber,
      jobId: input.jobId,
      customerId: input.customerId,
      contactId: input.contactId ?? null,
      validUntil: input.validUntil ?? null,
      subtotal: String(input.subtotal),
      taxTotal: String(input.taxTotal),
      total: String(input.total),
      supersedesEstimateId: input.supersedesEstimateId ?? null,
    })
    .returning();
  if (!estimate) throw new Error('Failed to insert estimate');
  return estimate;
}

export async function findEstimateById(
  tx: DatabaseClient,
  estimateId: string,
): Promise<Estimate | undefined> {
  const [estimate] = await tx
    .select()
    .from(schema.estimates)
    .where(and(eq(schema.estimates.id, estimateId), isNull(schema.estimates.deletedAt)))
    .limit(1);
  return estimate;
}

/** The one Estimate currently driving a Job's billed scope — estimates.md business rule 3: "at most one may be in `approved` status ... at a time." */
export async function findApprovedEstimateForJob(
  tx: DatabaseClient,
  jobId: string,
): Promise<Estimate | undefined> {
  const [estimate] = await tx
    .select()
    .from(schema.estimates)
    .where(
      and(
        eq(schema.estimates.jobId, jobId),
        eq(schema.estimates.status, 'approved'),
        isNull(schema.estimates.deletedAt),
      ),
    )
    .limit(1);
  return estimate;
}

export interface UpdateEstimateTotalsInput {
  subtotal: number;
  taxTotal: number;
  total: number;
}

export async function updateEstimateTotals(
  tx: DatabaseClient,
  estimateId: string,
  input: UpdateEstimateTotalsInput,
): Promise<Estimate | undefined> {
  const [estimate] = await tx
    .update(schema.estimates)
    .set({
      subtotal: String(input.subtotal),
      taxTotal: String(input.taxTotal),
      total: String(input.total),
      updatedAt: new Date(),
    })
    .where(eq(schema.estimates.id, estimateId))
    .returning();
  return estimate;
}

export interface SetEstimateStatusInput {
  status: EstimateStatus;
  sentAt?: Date | null | undefined;
  approvedAt?: Date | null | undefined;
  approvedByContactId?: string | null | undefined;
  approvedByUserId?: string | null | undefined;
  rejectedAt?: Date | null | undefined;
  rejectionReason?: string | null | undefined;
  cancellationReason?: string | null | undefined;
}

export async function setEstimateStatus(
  tx: DatabaseClient,
  estimateId: string,
  input: SetEstimateStatusInput,
): Promise<Estimate | undefined> {
  const [estimate] = await tx
    .update(schema.estimates)
    .set({
      status: input.status,
      ...(input.sentAt !== undefined ? { sentAt: input.sentAt } : {}),
      ...(input.approvedAt !== undefined ? { approvedAt: input.approvedAt } : {}),
      ...(input.approvedByContactId !== undefined
        ? { approvedByContactId: input.approvedByContactId }
        : {}),
      ...(input.approvedByUserId !== undefined ? { approvedByUserId: input.approvedByUserId } : {}),
      ...(input.rejectedAt !== undefined ? { rejectedAt: input.rejectedAt } : {}),
      ...(input.rejectionReason !== undefined ? { rejectionReason: input.rejectionReason } : {}),
      ...(input.cancellationReason !== undefined
        ? { cancellationReason: input.cancellationReason }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.estimates.id, estimateId))
    .returning();
  return estimate;
}

export type EstimateSortField = 'created_at' | 'estimate_number';
export type SortDirection = 'asc' | 'desc';

export interface EstimateCursor {
  sortValue: string;
  id: string;
}

export interface ListEstimatesParams {
  organizationId: string;
  limit: number;
  cursor?: EstimateCursor | undefined;
  sortField: EstimateSortField;
  sortDirection: SortDirection;
  status?: EstimateStatus | undefined;
  jobId?: string | undefined;
  customerId?: string | undefined;
}

export interface ListEstimatesResult {
  rows: Estimate[];
  hasMore: boolean;
}

function estimateCursorCondition(
  sortField: EstimateSortField,
  direction: SortDirection,
  cursor: EstimateCursor | undefined,
) {
  if (!cursor) return undefined;
  const op = direction === 'desc' ? sql`<` : sql`>`;
  if (sortField === 'created_at') {
    return sql`(${schema.estimates.createdAt}, ${schema.estimates.id}) ${op} (${new Date(cursor.sortValue)}::timestamptz, ${cursor.id}::uuid)`;
  }
  return sql`(${schema.estimates.estimateNumber}, ${schema.estimates.id}) ${op} (${Number(cursor.sortValue)}::integer, ${cursor.id}::uuid)`;
}

export async function listEstimatesForOrganization(
  tx: DatabaseClient,
  params: ListEstimatesParams,
): Promise<ListEstimatesResult> {
  const conditions = [
    eq(schema.estimates.organizationId, params.organizationId),
    isNull(schema.estimates.deletedAt),
  ];
  if (params.status) conditions.push(eq(schema.estimates.status, params.status));
  if (params.jobId) conditions.push(eq(schema.estimates.jobId, params.jobId));
  if (params.customerId) conditions.push(eq(schema.estimates.customerId, params.customerId));
  const cursorCondition = estimateCursorCondition(
    params.sortField,
    params.sortDirection,
    params.cursor,
  );
  if (cursorCondition) conditions.push(cursorCondition);

  const sortColumn =
    params.sortField === 'created_at'
      ? schema.estimates.createdAt
      : schema.estimates.estimateNumber;
  const orderExpr =
    params.sortDirection === 'desc'
      ? sql`${sortColumn} DESC, ${schema.estimates.id} DESC`
      : sql`${sortColumn} ASC, ${schema.estimates.id} ASC`;

  const rows = await tx
    .select()
    .from(schema.estimates)
    .where(and(...conditions))
    .orderBy(orderExpr)
    .limit(params.limit + 1);

  const hasMore = rows.length > params.limit;
  return { rows: hasMore ? rows.slice(0, params.limit) : rows, hasMore };
}
