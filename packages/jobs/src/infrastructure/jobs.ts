import { and, eq, isNull, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';
import type { JobStatus } from '../domain/lifecycle';

export type Job = typeof schema.jobs.$inferSelect;
export type JobPriority = Job['priority'];
export type JobSource = Job['source'];

/** Raw snake_case row shape as returned by `tx.execute` (SQL column names), distinct from Drizzle's camelCase `$inferSelect` — mirrors @atlas/properties's `PropertyRow` pattern. */
type JobRow = {
  id: string;
  organization_id: string;
  job_number: number;
  job_type_id: string;
  service_category_id: string | null;
  status: JobStatus;
  priority: JobPriority;
  customer_id: string;
  property_id: string;
  contact_id: string | null;
  description: string | null;
  source: JobSource;
  cancellation_reason: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function jobFromRow(row: JobRow): Job {
  return {
    id: row.id,
    organizationId: row.organization_id,
    jobNumber: row.job_number,
    jobTypeId: row.job_type_id,
    serviceCategoryId: row.service_category_id,
    status: row.status,
    priority: row.priority,
    customerId: row.customer_id,
    propertyId: row.property_id,
    contactId: row.contact_id,
    description: row.description,
    source: row.source,
    cancellationReason: row.cancellation_reason,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateJobInput {
  organizationId: string;
  jobNumber: number;
  jobTypeId: string;
  serviceCategoryId?: string | undefined;
  priority?: JobPriority | undefined;
  customerId: string;
  propertyId: string;
  contactId?: string | undefined;
  description?: string | undefined;
  source?: JobSource | undefined;
}

export async function insertJob(tx: DatabaseClient, input: CreateJobInput): Promise<Job> {
  const [job] = await tx
    .insert(schema.jobs)
    .values({
      organizationId: input.organizationId,
      jobNumber: input.jobNumber,
      jobTypeId: input.jobTypeId,
      serviceCategoryId: input.serviceCategoryId ?? null,
      priority: input.priority ?? 'normal',
      customerId: input.customerId,
      propertyId: input.propertyId,
      contactId: input.contactId ?? null,
      description: input.description ?? null,
      source: input.source ?? 'phone',
    })
    .returning();
  if (!job) {
    throw new Error('Failed to insert job');
  }
  return job;
}

export async function findJobById(
  tx: DatabaseClient,
  jobId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<Job | undefined> {
  const conditions = [eq(schema.jobs.id, jobId)];
  if (!options.includeDeleted) {
    conditions.push(isNull(schema.jobs.deletedAt));
  }
  const [job] = await tx
    .select()
    .from(schema.jobs)
    .where(and(...conditions))
    .limit(1);
  return job;
}

export interface UpdateJobFields {
  jobTypeId?: string | undefined;
  serviceCategoryId?: string | null | undefined;
  priority?: JobPriority | undefined;
  contactId?: string | null | undefined;
  description?: string | null | undefined;
}

/** Ordinary field edits only — never `status` (see the dedicated `transitionJobStatus` application function) or `customerId`/`propertyId` (not documented as mutable post-creation). */
export async function updateJobFields(
  tx: DatabaseClient,
  jobId: string,
  fields: UpdateJobFields,
): Promise<Job | undefined> {
  const [job] = await tx
    .update(schema.jobs)
    .set({
      ...(fields.jobTypeId !== undefined ? { jobTypeId: fields.jobTypeId } : {}),
      ...(fields.serviceCategoryId !== undefined
        ? { serviceCategoryId: fields.serviceCategoryId }
        : {}),
      ...(fields.priority !== undefined ? { priority: fields.priority } : {}),
      ...(fields.contactId !== undefined ? { contactId: fields.contactId } : {}),
      ...(fields.description !== undefined ? { description: fields.description } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.jobs.id, jobId), isNull(schema.jobs.deletedAt)))
    .returning();
  return job;
}

export async function setJobStatus(
  tx: DatabaseClient,
  jobId: string,
  status: JobStatus,
  cancellationReason?: string | null,
): Promise<Job | undefined> {
  const [job] = await tx
    .update(schema.jobs)
    .set({
      status,
      ...(cancellationReason !== undefined ? { cancellationReason } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.jobs.id, jobId))
    .returning();
  return job;
}

/** Archive (`deletedAt` set) or restore (`deletedAt` cleared) — docs/04-database/soft-deletion.md. A distinct axis from `status`/`cancelled`. */
export async function setJobDeletedAt(
  tx: DatabaseClient,
  jobId: string,
  deletedAt: Date | null,
): Promise<Job | undefined> {
  const [job] = await tx
    .update(schema.jobs)
    .set({ deletedAt, updatedAt: new Date() })
    .where(eq(schema.jobs.id, jobId))
    .returning();
  return job;
}

export type JobSortField = 'created_at' | 'job_number';
export type SortDirection = 'asc' | 'desc';

export interface JobCursor {
  sortValue: string;
  id: string;
}

export interface ListJobsParams {
  organizationId: string;
  limit: number;
  cursor?: JobCursor | undefined;
  sortField: JobSortField;
  sortDirection: SortDirection;
  status?: JobStatus | undefined;
  priority?: JobPriority | undefined;
  customerId?: string | undefined;
  propertyId?: string | undefined;
  assignedToUserId?: string | undefined;
}

export interface ListJobsResult {
  rows: Job[];
  hasMore: boolean;
}

function jobCursorCondition(
  sortField: JobSortField,
  direction: SortDirection,
  cursor: JobCursor | undefined,
) {
  if (!cursor) return undefined;
  const op = direction === 'desc' ? sql`<` : sql`>`;
  if (sortField === 'created_at') {
    return sql`(${schema.jobs.createdAt}, ${schema.jobs.id}) ${op} (${new Date(cursor.sortValue)}::timestamptz, ${cursor.id}::uuid)`;
  }
  return sql`(${schema.jobs.jobNumber}, ${schema.jobs.id}) ${op} (${Number(cursor.sortValue)}::integer, ${cursor.id}::uuid)`;
}

/** Cursor-paginated, tenant-scoped Job listing — docs/05-api/pagination.md. */
export async function listJobsForOrganization(
  tx: DatabaseClient,
  params: ListJobsParams,
): Promise<ListJobsResult> {
  const conditions = [
    eq(schema.jobs.organizationId, params.organizationId),
    isNull(schema.jobs.deletedAt),
  ];
  if (params.status) conditions.push(eq(schema.jobs.status, params.status));
  if (params.priority) conditions.push(eq(schema.jobs.priority, params.priority));
  if (params.customerId) conditions.push(eq(schema.jobs.customerId, params.customerId));
  if (params.propertyId) conditions.push(eq(schema.jobs.propertyId, params.propertyId));
  if (params.assignedToUserId) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM jobs.job_assignments ja WHERE ja.job_id = ${schema.jobs.id} AND ja.user_id = ${params.assignedToUserId}::uuid)`,
    );
  }
  const cursorCondition = jobCursorCondition(params.sortField, params.sortDirection, params.cursor);
  if (cursorCondition) conditions.push(cursorCondition);

  const sortColumn =
    params.sortField === 'created_at' ? schema.jobs.createdAt : schema.jobs.jobNumber;
  const orderExpr =
    params.sortDirection === 'desc'
      ? sql`${sortColumn} DESC, ${schema.jobs.id} DESC`
      : sql`${sortColumn} ASC, ${schema.jobs.id} ASC`;

  const rows = await tx
    .select()
    .from(schema.jobs)
    .where(and(...conditions))
    .orderBy(orderExpr)
    .limit(params.limit + 1);

  const hasMore = rows.length > params.limit;
  return { rows: hasMore ? rows.slice(0, params.limit) : rows, hasMore };
}

export interface JobSearchHit {
  job: Job;
  rank: number;
}

/**
 * Job search — search-strategy.md: "job number, customer name
 * (denormalized), property address (denormalized)". Joins to
 * `crm.customers.search_vector`/`properties.properties.search_vector`
 * at query time instead of duplicating that text onto `jobs` — see
 * migration 0017's header comment and SPRINT-4-COMPLETION-REPORT.md,
 * "Architecture Decisions".
 */
export async function searchJobs(
  tx: DatabaseClient,
  organizationId: string,
  query: string,
  limit: number,
): Promise<JobSearchHit[]> {
  const rows = await tx.execute<JobRow & { rank: number }>(sql`
    SELECT j.*,
      ts_rank(j.search_vector, websearch_to_tsquery('simple', ${query}))
      + ts_rank(c.search_vector, websearch_to_tsquery('simple', ${query}))
      + ts_rank(p.search_vector, websearch_to_tsquery('simple', ${query}))
      AS rank
    FROM jobs.jobs j
    JOIN crm.customers c ON c.id = j.customer_id
    JOIN properties.properties p ON p.id = j.property_id
    WHERE j.organization_id = ${organizationId}::uuid
      AND j.deleted_at IS NULL
      AND (
        j.search_vector @@ websearch_to_tsquery('simple', ${query})
        OR c.search_vector @@ websearch_to_tsquery('simple', ${query})
        OR p.search_vector @@ websearch_to_tsquery('simple', ${query})
      )
    ORDER BY rank DESC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({ job: jobFromRow(row), rank: Number(row.rank) }));
}
