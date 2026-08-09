import { z } from 'zod';
import {
  createJob,
  listJobs,
  searchJobs,
  type JobSortField,
  type SortDirection,
} from '@atlas/jobs';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { decodeCursor, encodeCursor, parseLimit } from '@/lib/cursor';
import { serializeJob } from '@/lib/jobs-serializers';

/**
 * GET /api/v1/jobs — jobs-prd.md §11. Sortable fields: `created_at`
 * (default, descending), `job_number` — docs/05-api/sorting.md.
 * Filterable fields: `status`, `priority`, `customer_id`, `property_id`,
 * `assigned_to_me`, `search` (full-text, joined to Customer/Property —
 * see @atlas/jobs's `searchJobs`). Search mode returns ranked matches
 * without cursor pagination — mirrors CRM/Properties' `?search=`
 * precedent.
 */
const SORTABLE_FIELDS: Record<string, JobSortField> = {
  created_at: 'created_at',
  job_number: 'job_number',
};

const JOB_STATUSES = [
  'draft',
  'scheduled',
  'dispatched',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
] as const;
const JOB_PRIORITIES = ['normal', 'urgent', 'emergency'] as const;
const JOB_SOURCES = ['phone', 'portal', 'repeat_visit', 'marketplace'] as const;

function parseEnum<T extends readonly string[]>(
  raw: string | null,
  values: T,
  field: string,
): T[number] | undefined {
  if (!raw) return undefined;
  if ((values as readonly string[]).includes(raw)) {
    return raw as T[number];
  }
  throw new AppError('validation_error', `Invalid ${field} filter.`, [
    { field, issue: `Must be one of: ${values.join(', ')}` },
  ]);
}

function parseSort(raw: string | null): { field: JobSortField; direction: SortDirection } {
  if (!raw) return { field: 'created_at', direction: 'desc' };
  const [first] = raw.split(',');
  const token = first ?? '-created_at';
  const direction: SortDirection = token.startsWith('-') ? 'desc' : 'asc';
  const fieldName = token.startsWith('-') ? token.slice(1) : token;
  const field = SORTABLE_FIELDS[fieldName];
  if (!field) {
    throw new AppError('validation_error', `Unsupported sort field: ${fieldName}`, [
      { field: 'sort', issue: `Must be one of: ${Object.keys(SORTABLE_FIELDS).join(', ')}` },
    ]);
  }
  return { field, direction };
}

export const GET = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const limit = parseLimit(url.searchParams.get('limit'));
  const search = url.searchParams.get('search');

  if (search) {
    if (search.length < 2) {
      return { data: [], meta: { next_cursor: null, has_more: false } };
    }
    const hits = await searchJobs(getDb(), {
      organizationId,
      actorUserId: actor.id,
      query: search,
      limit,
    });
    return {
      data: hits.map((hit) => serializeJob(hit.job)),
      meta: { next_cursor: null, has_more: false },
    };
  }

  const status = parseEnum(url.searchParams.get('status'), JOB_STATUSES, 'status');
  const priority = parseEnum(url.searchParams.get('priority'), JOB_PRIORITIES, 'priority');
  const customerId = url.searchParams.get('customer_id') ?? undefined;
  const propertyId = url.searchParams.get('property_id') ?? undefined;
  const assignedToMe = url.searchParams.get('assigned_to_me') === 'true';
  const { field, direction } = parseSort(url.searchParams.get('sort'));
  const cursorParam = url.searchParams.get('cursor');

  const { rows, hasMore } = await listJobs(getDb(), {
    organizationId,
    actorUserId: actor.id,
    limit,
    cursor: cursorParam ? decodeCursor(cursorParam) : undefined,
    sortField: field,
    sortDirection: direction,
    status,
    priority,
    customerId,
    propertyId,
    assignedToMe,
  });

  const last = rows.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          sortValue: field === 'created_at' ? last.createdAt.toISOString() : String(last.jobNumber),
          id: last.id,
        })
      : null;

  return {
    data: rows.map(serializeJob),
    meta: { next_cursor: nextCursor, has_more: hasMore },
  };
});

/** POST /api/v1/jobs — jobs-prd.md §11. */
const createJobSchema = z.object({
  organization_id: z.string().uuid(),
  job_type_id: z.string().uuid(),
  service_category_id: z.string().uuid().optional(),
  priority: z.enum(JOB_PRIORITIES).optional(),
  customer_id: z.string().uuid(),
  property_id: z.string().uuid(),
  contact_id: z.string().uuid().optional(),
  description: z.string().max(5000).optional(),
  source: z.enum(JOB_SOURCES).optional(),
  asset_ids: z.array(z.string().uuid()).optional(),
});

export const POST = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const json = await request.json().catch(() => null);
  const parsed = createJobSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'Invalid job payload.',
      parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
    );
  }

  const result = await createJob(getDb(), {
    organizationId: parsed.data.organization_id,
    actorUserId: actor.id,
    jobTypeId: parsed.data.job_type_id,
    serviceCategoryId: parsed.data.service_category_id,
    priority: parsed.data.priority,
    customerId: parsed.data.customer_id,
    propertyId: parsed.data.property_id,
    contactId: parsed.data.contact_id,
    description: parsed.data.description,
    source: parsed.data.source,
    assetIds: parsed.data.asset_ids,
  });

  return {
    data: { job: serializeJob(result.job), task_count: result.taskCount },
    status: 201,
  };
});
