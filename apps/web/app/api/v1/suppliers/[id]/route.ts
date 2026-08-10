import { z } from 'zod';
import { deleteSupplier, getSupplier, updateSupplier } from '@atlas/suppliers';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeSupplier } from '@/lib/inventory-serializers';

/** GET /api/v1/suppliers/{id} — suppliers-prd.md §11. */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const supplier = await getSupplier(getDb(), {
    organizationId,
    actorUserId: actor.id,
    supplierId: context.params.id,
  });
  return { data: serializeSupplier(supplier) };
});

/** PATCH /api/v1/suppliers/{id}. */
const updateSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  contact_name: z.string().max(200).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  account_number: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const PATCH = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid Supplier payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const supplier = await updateSupplier(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      supplierId: context.params.id,
      fields: {
        name: parsed.data.name,
        contactName: parsed.data.contact_name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        accountNumber: parsed.data.account_number,
        notes: parsed.data.notes,
      },
    });
    return { data: serializeSupplier(supplier) };
  },
);

/** DELETE /api/v1/suppliers/{id} — soft delete (deleted_at). */
const deleteQuerySchema = z.object({ organization_id: z.string().uuid() });

export const DELETE = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const parsed = deleteQuerySchema.safeParse({
      organization_id: new URL(request.url).searchParams.get('organization_id'),
    });
    if (!parsed.success) {
      throw new AppError('bad_request', 'organization_id query parameter is required.');
    }
    const supplier = await deleteSupplier(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      supplierId: context.params.id,
    });
    return { data: serializeSupplier(supplier) };
  },
);
