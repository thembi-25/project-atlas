import { NextResponse } from 'next/server';
import { listJobs, type Job } from '@atlas/jobs';
import { listInvoices, listPayments, type Invoice, type Payment } from '@atlas/financials';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError, toApiErrorBody, toAppError } from '@/lib/errors';
import { mapJobsError } from '@/lib/jobs-errors';
import { mapFinancialsError } from '@/lib/financials-errors';
import { getServerEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { REQUEST_ID_HEADER, resolveRequestId } from '@/lib/request-id';
import { toCsv, type CsvColumn } from '@/lib/csv';

/**
 * GET /api/v1/exports — reporting-prd.md §7/§11, scoped down per
 * docs/13-roadmap/sprint-7.md's "Scope decisions" to synchronous CSV
 * export of existing list endpoints only (no `export_jobs` async queue,
 * no PDF generation). Not wrapped in `withApiHandler` — that helper
 * always returns the `{data}` JSON envelope, but this route returns a
 * raw `text/csv` body — so auth/error handling is done inline here,
 * mirroring `withApiHandler`'s own logic exactly (docs/05-api/errors.md).
 *
 * `reporting-prd.md` §3/§17 calls for "no silent row caps" and
 * "streaming/batching" for very large exports — the full async job path
 * needed for that is explicitly out of this sprint's scope, so this is
 * capped at `MAX_EXPORT_ROWS`, a disclosed simplification (see
 * docs/13-roadmap/SPRINT-7-COMPLETION-REPORT.md, Known Limitations), not
 * silent truncation — `X-Export-Truncated` is set when the cap is hit.
 * Authorization/tenant-scoping is identical to the underlying list
 * endpoint (reporting-prd.md §8/§12) since this calls the exact same
 * application-layer functions (`listJobs`/`listInvoices`/`listPayments`).
 */
const RESOURCE_TYPES = ['jobs', 'invoices', 'payments'] as const;
type ResourceType = (typeof RESOURCE_TYPES)[number];

const MAX_EXPORT_ROWS = 5000;
const EXPORT_PAGE_SIZE = 500;

const JOB_STATUSES = [
  'draft',
  'scheduled',
  'dispatched',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
] as const;
const INVOICE_STATUSES = ['draft', 'finalized', 'sent', 'partially_paid', 'paid', 'void'] as const;
const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'] as const;

const JOB_COLUMNS: CsvColumn<Job>[] = [
  { header: 'id', value: (r) => r.id },
  { header: 'job_number', value: (r) => String(r.jobNumber) },
  { header: 'status', value: (r) => r.status },
  { header: 'priority', value: (r) => r.priority },
  { header: 'customer_id', value: (r) => r.customerId },
  { header: 'property_id', value: (r) => r.propertyId },
  { header: 'created_at', value: (r) => r.createdAt.toISOString() },
];

const INVOICE_COLUMNS: CsvColumn<Invoice>[] = [
  { header: 'id', value: (r) => r.id },
  { header: 'invoice_number', value: (r) => (r.invoiceNumber !== null ? String(r.invoiceNumber) : '') },
  { header: 'status', value: (r) => r.status },
  { header: 'customer_id', value: (r) => r.customerId },
  { header: 'job_id', value: (r) => r.jobId },
  { header: 'total', value: (r) => r.total },
  { header: 'due_date', value: (r) => (r.dueDate ? r.dueDate.toISOString() : '') },
  { header: 'created_at', value: (r) => r.createdAt.toISOString() },
];

const PAYMENT_COLUMNS: CsvColumn<Payment>[] = [
  { header: 'id', value: (r) => r.id },
  { header: 'invoice_id', value: (r) => r.invoiceId },
  { header: 'amount', value: (r) => r.amount },
  { header: 'method', value: (r) => r.method },
  { header: 'status', value: (r) => r.status },
  { header: 'created_at', value: (r) => r.createdAt.toISOString() },
];

function parseEnumStatus<T extends readonly string[]>(raw: string | null, values: T): T[number] | undefined {
  if (!raw) return undefined;
  if ((values as readonly string[]).includes(raw)) return raw as T[number];
  throw new AppError('validation_error', `Unsupported status: ${raw}`, [
    { field: 'status', issue: `Must be one of: ${values.join(', ')}` },
  ]);
}

interface ExportResult {
  csv: string;
  truncated: boolean;
}

async function exportJobs(params: { organizationId: string; actorUserId: string; status: string | null }): Promise<ExportResult> {
  const status = parseEnumStatus(params.status, JOB_STATUSES);
  const db = getDb();
  const rows: Job[] = [];
  let cursor: { sortValue: string; id: string } | undefined;
  let hasMore = true;
  while (hasMore && rows.length < MAX_EXPORT_ROWS) {
    const page = await listJobs(db, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      limit: EXPORT_PAGE_SIZE,
      cursor,
      sortField: 'created_at',
      sortDirection: 'desc',
      status,
    });
    rows.push(...page.rows);
    hasMore = page.hasMore;
    const last = page.rows.at(-1);
    cursor = last ? { sortValue: last.createdAt.toISOString(), id: last.id } : undefined;
  }
  const truncated = rows.length > MAX_EXPORT_ROWS;
  return { csv: toCsv(truncated ? rows.slice(0, MAX_EXPORT_ROWS) : rows, JOB_COLUMNS), truncated };
}

async function exportInvoices(params: { organizationId: string; actorUserId: string; status: string | null }): Promise<ExportResult> {
  const status = parseEnumStatus(params.status, INVOICE_STATUSES);
  const db = getDb();
  const rows: Invoice[] = [];
  let cursor: { sortValue: string; id: string } | undefined;
  let hasMore = true;
  while (hasMore && rows.length < MAX_EXPORT_ROWS) {
    const page = await listInvoices(db, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      limit: EXPORT_PAGE_SIZE,
      cursor,
      sortField: 'created_at',
      sortDirection: 'desc',
      status,
    });
    rows.push(...page.rows);
    hasMore = page.hasMore;
    const last = page.rows.at(-1);
    cursor = last ? { sortValue: last.createdAt.toISOString(), id: last.id } : undefined;
  }
  const truncated = rows.length > MAX_EXPORT_ROWS;
  return { csv: toCsv(truncated ? rows.slice(0, MAX_EXPORT_ROWS) : rows, INVOICE_COLUMNS), truncated };
}

async function exportPayments(params: { organizationId: string; actorUserId: string; status: string | null }): Promise<ExportResult> {
  const status = parseEnumStatus(params.status, PAYMENT_STATUSES);
  const db = getDb();
  const rows: Payment[] = [];
  let cursor: { sortValue: string; id: string } | undefined;
  let hasMore = true;
  while (hasMore && rows.length < MAX_EXPORT_ROWS) {
    const page = await listPayments(db, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      limit: EXPORT_PAGE_SIZE,
      cursor,
      status,
    });
    rows.push(...page.rows);
    hasMore = page.hasMore;
    const last = page.rows.at(-1);
    cursor = last ? { sortValue: last.createdAt.toISOString(), id: last.id } : undefined;
  }
  const truncated = rows.length > MAX_EXPORT_ROWS;
  return { csv: toCsv(truncated ? rows.slice(0, MAX_EXPORT_ROWS) : rows, PAYMENT_COLUMNS), truncated };
}

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = resolveRequestId(request.headers);
  const log = logger.child({ requestId });

  try {
    const actor = await getAuthenticatedUser();
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organization_id');
    if (!organizationId) {
      throw new AppError('bad_request', 'organization_id query parameter is required.');
    }
    const resourceTypeParam = url.searchParams.get('resource_type');
    if (!resourceTypeParam || !(RESOURCE_TYPES as readonly string[]).includes(resourceTypeParam)) {
      throw new AppError('validation_error', 'resource_type must be one of: jobs, invoices, payments.');
    }
    const resourceType = resourceTypeParam as ResourceType;
    const status = url.searchParams.get('status');

    const { csv, truncated } =
      resourceType === 'jobs'
        ? await exportJobs({ organizationId, actorUserId: actor.id, status })
        : resourceType === 'invoices'
          ? await exportInvoices({ organizationId, actorUserId: actor.id, status })
          : await exportPayments({ organizationId, actorUserId: actor.id, status });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${resourceType}-export.csv"`,
        'X-Export-Truncated': String(truncated),
        [REQUEST_ID_HEADER]: requestId,
      },
    });
  } catch (rawError) {
    const error = mapJobsError(rawError) ?? mapFinancialsError(rawError) ?? toAppError(rawError);
    if (error.code === 'internal_error') {
      log.error('Unhandled export route error', {
        error: error.message,
        stack: rawError instanceof Error ? rawError.stack : undefined,
      });
    }
    const isProduction = getServerEnv().NODE_ENV === 'production';
    return NextResponse.json(toApiErrorBody(error, isProduction), {
      status: error.status,
      headers: { [REQUEST_ID_HEADER]: requestId },
    });
  }
}
