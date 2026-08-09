import { z } from 'zod';
import {
  createProperty,
  listProperties,
  searchProperties,
  type PropertySortField,
  type SortDirection,
} from '@atlas/properties';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { decodeCursor, encodeCursor, parseLimit } from '@/lib/cursor';
import { serializeProperty } from '@/lib/properties-serializers';

/**
 * GET /api/v1/properties — properties-prd.md §11.
 * Sortable fields: `created_at` (default, descending), `address_line1` —
 * docs/05-api/sorting.md. Filterable fields: `property_type` (equality),
 * `search` (full-text + trigram over the address, docs/02-architecture/
 * search-strategy.md). Search mode returns ranked matches without cursor
 * pagination — mirrors CRM's `/api/v1/customers?search=` precedent (see
 * docs/13-roadmap/SPRINT-2-COMPLETION-REPORT.md, "Deviations").
 */
const SORTABLE_FIELDS: Record<string, PropertySortField> = {
  created_at: 'created_at',
  address_line1: 'address_line1',
};

const PROPERTY_TYPES = [
  'residential_single_family',
  'residential_multi_unit',
  'commercial',
] as const;

function parsePropertyType(raw: string | null): (typeof PROPERTY_TYPES)[number] | undefined {
  if (!raw) return undefined;
  if ((PROPERTY_TYPES as readonly string[]).includes(raw)) {
    return raw as (typeof PROPERTY_TYPES)[number];
  }
  throw new AppError('validation_error', 'Invalid property_type filter.', [
    { field: 'property_type', issue: `Must be one of: ${PROPERTY_TYPES.join(', ')}` },
  ]);
}

function parseSort(raw: string | null): { field: PropertySortField; direction: SortDirection } {
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
    const hits = await searchProperties(getDb(), {
      organizationId,
      actorUserId: actor.id,
      query: search,
      limit,
    });
    return {
      data: hits.map((hit) => serializeProperty(hit.property)),
      meta: { next_cursor: null, has_more: false },
    };
  }

  const propertyType = parsePropertyType(url.searchParams.get('property_type'));
  const { field, direction } = parseSort(url.searchParams.get('sort'));
  const cursorParam = url.searchParams.get('cursor');

  const { rows, hasMore } = await listProperties(getDb(), {
    organizationId,
    actorUserId: actor.id,
    limit,
    cursor: cursorParam ? decodeCursor(cursorParam) : undefined,
    sortField: field,
    sortDirection: direction,
    propertyType,
  });

  const last = rows.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          sortValue: field === 'created_at' ? last.createdAt.toISOString() : last.addressLine1,
          id: last.id,
        })
      : null;

  return {
    data: rows.map(serializeProperty),
    meta: { next_cursor: nextCursor, has_more: hasMore },
  };
});

/** POST /api/v1/properties — properties-prd.md §11. */
const createPropertySchema = z.object({
  organization_id: z.string().uuid(),
  property_type: z.enum(PROPERTY_TYPES),
  address_line1: z.string().min(1).max(200),
  address_line2: z.string().max(200).optional(),
  address_city: z.string().max(100).optional(),
  address_region: z.string().max(100).optional(),
  address_postal_code: z.string().max(20).optional(),
  address_country: z.string().max(100).optional(),
  latitude: z.string().max(20).optional(),
  longitude: z.string().max(20).optional(),
  access_notes: z.string().max(5000).optional(),
  acknowledge_duplicate: z.boolean().optional(),
  customer_id: z.string().uuid().optional(),
});

export const POST = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const json = await request.json().catch(() => null);
  const parsed = createPropertySchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'Invalid property payload.',
      parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
    );
  }

  const result = await createProperty(getDb(), {
    organizationId: parsed.data.organization_id,
    actorUserId: actor.id,
    propertyType: parsed.data.property_type,
    addressLine1: parsed.data.address_line1,
    addressLine2: parsed.data.address_line2,
    addressCity: parsed.data.address_city,
    addressRegion: parsed.data.address_region,
    addressPostalCode: parsed.data.address_postal_code,
    addressCountry: parsed.data.address_country,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    accessNotes: parsed.data.access_notes,
    acknowledgeDuplicate: parsed.data.acknowledge_duplicate,
    customerId: parsed.data.customer_id,
  });

  return {
    data: {
      property: serializeProperty(result.property),
      default_building_id: result.defaultBuilding?.id ?? null,
      customer_association_id: result.customerAssociation?.id ?? null,
    },
    status: 201,
  };
});
