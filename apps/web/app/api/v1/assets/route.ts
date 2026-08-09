import { z } from 'zod';
import { createAsset, listAssets, searchAssets, type SortDirection } from '@atlas/assets';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { decodeCursor, encodeCursor, parseLimit } from '@/lib/cursor';
import { serializeAsset } from '@/lib/assets-serializers';

const ASSET_STATUSES = ['active', 'removed', 'decommissioned'] as const;

function parseAssetStatus(raw: string | null): (typeof ASSET_STATUSES)[number] | undefined {
  if (!raw) return undefined;
  if ((ASSET_STATUSES as readonly string[]).includes(raw)) {
    return raw as (typeof ASSET_STATUSES)[number];
  }
  throw new AppError('validation_error', 'Invalid status filter.', [
    { field: 'status', issue: `Must be one of: ${ASSET_STATUSES.join(', ')}` },
  ]);
}

function parseSortDirection(raw: string | null): SortDirection {
  if (!raw) return 'desc';
  const token = raw.split(',')[0] ?? '-created_at';
  return token.startsWith('-') ? 'desc' : 'asc';
}

/**
 * GET /api/v1/assets — assets-prd.md §11. Filterable: `property_id`
 * (equality — the Asset list on the Property detail page),
 * `status`, `search` (manufacturer/model/serial full-text + trigram,
 * docs/02-architecture/search-strategy.md). Search mode returns ranked
 * matches without cursor pagination, mirroring CRM/Properties search.
 */
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
    const hits = await searchAssets(getDb(), {
      organizationId,
      actorUserId: actor.id,
      query: search,
      limit,
    });
    return {
      data: hits.map((hit) => serializeAsset(hit.asset)),
      meta: { next_cursor: null, has_more: false },
    };
  }

  const propertyId = url.searchParams.get('property_id') ?? undefined;
  const status = parseAssetStatus(url.searchParams.get('status'));
  const direction = parseSortDirection(url.searchParams.get('sort'));
  const cursorParam = url.searchParams.get('cursor');

  const { rows, hasMore } = await listAssets(getDb(), {
    organizationId,
    actorUserId: actor.id,
    propertyId,
    limit,
    cursor: cursorParam ? decodeCursor(cursorParam) : undefined,
    sortDirection: direction,
    status,
  });

  const last = rows.at(-1);
  const nextCursor =
    hasMore && last ? encodeCursor({ sortValue: last.createdAt.toISOString(), id: last.id }) : null;

  return {
    data: rows.map(serializeAsset),
    meta: { next_cursor: nextCursor, has_more: hasMore },
  };
});

/** POST /api/v1/assets — assets-prd.md §11. */
const createAssetSchema = z.object({
  organization_id: z.string().uuid(),
  property_id: z.string().uuid(),
  building_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional(),
  asset_type_id: z.string().uuid(),
  manufacturer_name: z.string().max(200).optional(),
  model_number: z.string().max(200).optional(),
  serial_number: z.string().max(200).optional(),
  install_date: z.string().date().optional(),
});

export const POST = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const json = await request.json().catch(() => null);
  const parsed = createAssetSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'Invalid asset payload.',
      parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
    );
  }

  const asset = await createAsset(getDb(), {
    organizationId: parsed.data.organization_id,
    actorUserId: actor.id,
    propertyId: parsed.data.property_id,
    buildingId: parsed.data.building_id,
    roomId: parsed.data.room_id,
    assetTypeId: parsed.data.asset_type_id,
    manufacturerName: parsed.data.manufacturer_name,
    modelNumber: parsed.data.model_number,
    serialNumber: parsed.data.serial_number,
    installDate: parsed.data.install_date,
  });

  return { data: serializeAsset(asset), status: 201 };
});
