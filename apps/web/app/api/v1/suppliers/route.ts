import { z } from 'zod';
import {
  createSupplier,
  listSuppliers,
  type SortDirection,
  type SupplierSortField,
} from '@atlas/suppliers';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { decodeCursor, encodeCursor, parseLimit } from '@/lib/cursor';
import { serializeSupplier } from '@/lib/inventory-serializers';

/** GET /api/v1/suppliers — suppliers-prd.md §11. Sortable: `created_at` (default), `name`. */
const SORTABLE_FIELDS: Record<string, SupplierSortField> = {
  created_at: 'created_at',
  name: 'name',
};

function parseSort(raw: string | null): { field: SupplierSortField; direction: SortDirection } {
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
  const { field, direction } = parseSort(url.searchParams.get('sort'));
  const cursorParam = url.searchParams.get('cursor');

  const { rows, hasMore } = await listSuppliers(getDb(), {
    organizationId,
    actorUserId: actor.id,
    limit,
    cursor: cursorParam ? decodeCursor(cursorParam) : undefined,
    sortField: field,
    sortDirection: direction,
  });

  const last = rows.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          sortValue: field === 'created_at' ? last.createdAt.toISOString() : last.name,
          id: last.id,
        })
      : null;

  return {
    data: rows.map(serializeSupplier),
    meta: { next_cursor: nextCursor, has_more: hasMore },
  };
});

/** POST /api/v1/suppliers — suppliers-prd.md §11. */
const createSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  contact_name: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  account_number: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export const POST = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'Invalid Supplier payload.',
      parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
    );
  }
  const supplier = await createSupplier(getDb(), {
    organizationId: parsed.data.organization_id,
    actorUserId: actor.id,
    name: parsed.data.name,
    contactName: parsed.data.contact_name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    accountNumber: parsed.data.account_number,
    notes: parsed.data.notes,
  });
  return { data: serializeSupplier(supplier), status: 201 };
});
