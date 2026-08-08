import { z } from 'zod';
import {
  createCustomer,
  listCustomers,
  searchCustomers,
  type CustomerSortField,
  type SortDirection,
} from '@atlas/crm';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { decodeCursor, encodeCursor, parseLimit } from '@/lib/cursor';
import { serializeCustomer } from '@/lib/crm-serializers';

/**
 * GET /api/v1/customers — Customers PRD §11.
 * Sortable fields: `created_at` (default, descending), `display_name` —
 * docs/05-api/sorting.md. Filterable fields: `type` (equality), `search`
 * (full-text + trigram, docs/02-architecture/search-strategy.md). Search
 * mode returns ranked matches without cursor pagination (see
 * SPRINT-2-COMPLETION-REPORT.md, "Deviations" — the CRM PRD's unified
 * cross-entity `/api/v1/search` endpoint is deferred until Properties and
 * Jobs exist; this is Customer/Contact search via the standard `search`
 * filter instead).
 */
const SORTABLE_FIELDS: Record<string, CustomerSortField> = {
  created_at: 'created_at',
  display_name: 'display_name',
};

function parseCustomerType(raw: string | null): 'residential' | 'commercial' | undefined {
  if (!raw) return undefined;
  if (raw === 'residential' || raw === 'commercial') return raw;
  throw new AppError('validation_error', 'Invalid type filter.', [
    { field: 'type', issue: 'Must be "residential" or "commercial".' },
  ]);
}

function parseSort(raw: string | null): { field: CustomerSortField; direction: SortDirection } {
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
    const hits = await searchCustomers(getDb(), {
      organizationId,
      actorUserId: actor.id,
      query: search,
      limit,
    });
    return {
      data: hits.map((hit) => serializeCustomer(hit.customer)),
      meta: { next_cursor: null, has_more: false },
    };
  }

  const type = parseCustomerType(url.searchParams.get('type'));
  const { field, direction } = parseSort(url.searchParams.get('sort'));
  const cursorParam = url.searchParams.get('cursor');

  const { rows, hasMore } = await listCustomers(getDb(), {
    organizationId,
    actorUserId: actor.id,
    limit,
    cursor: cursorParam ? decodeCursor(cursorParam) : undefined,
    sortField: field,
    sortDirection: direction,
    type,
  });

  const last = rows.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          sortValue: field === 'created_at' ? last.createdAt.toISOString() : last.displayName,
          id: last.id,
        })
      : null;

  return {
    data: rows.map(serializeCustomer),
    meta: { next_cursor: nextCursor, has_more: hasMore },
  };
});

/**
 * POST /api/v1/customers — Customers PRD §7 quick-create flow: name +
 * phone/address only, other fields optional.
 */
const addressSchema = z.object({
  line1: z.string().max(200).optional(),
  line2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  postal_code: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
});

const primaryContactSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  role_title: z.string().max(200).optional(),
});

const createCustomerSchema = z.object({
  organization_id: z.string().uuid(),
  type: z.enum(['residential', 'commercial']),
  display_name: z.string().min(1).max(200),
  billing_address: addressSchema.optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(5000).optional(),
  portal_access_enabled: z.boolean().optional(),
  primary_contact: primaryContactSchema.optional(),
});

export const POST = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const json = await request.json().catch(() => null);
  const parsed = createCustomerSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'Invalid customer payload.',
      parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
    );
  }

  const result = await createCustomer(getDb(), {
    organizationId: parsed.data.organization_id,
    actorUserId: actor.id,
    type: parsed.data.type,
    displayName: parsed.data.display_name,
    billingAddressLine1: parsed.data.billing_address?.line1,
    billingAddressLine2: parsed.data.billing_address?.line2,
    billingAddressCity: parsed.data.billing_address?.city,
    billingAddressRegion: parsed.data.billing_address?.region,
    billingAddressPostalCode: parsed.data.billing_address?.postal_code,
    billingAddressCountry: parsed.data.billing_address?.country,
    tags: parsed.data.tags,
    notes: parsed.data.notes,
    portalAccessEnabled: parsed.data.portal_access_enabled,
    primaryContact: parsed.data.primary_contact
      ? {
          name: parsed.data.primary_contact.name,
          phone: parsed.data.primary_contact.phone,
          email: parsed.data.primary_contact.email,
          roleTitle: parsed.data.primary_contact.role_title,
        }
      : undefined,
  });

  return {
    data: {
      customer: serializeCustomer(result.customer),
      primary_contact_id: result.primaryContact.id,
      potential_duplicates: result.potentialDuplicates.map(serializeCustomer),
    },
    status: 201,
  };
});
