import { z } from 'zod';
import { archiveAsset, getAsset, updateAsset } from '@atlas/assets';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeAsset } from '@/lib/assets-serializers';

/** GET /api/v1/assets/{id} — assets-prd.md §11. */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const organizationId = new URL(request.url).searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const asset = await getAsset(getDb(), {
    organizationId,
    actorUserId: actor.id,
    assetId: context.params.id,
  });
  return { data: serializeAsset(asset) };
});

const patchAssetSchema = z.object({
  organization_id: z.string().uuid(),
  building_id: z.string().uuid().nullable().optional(),
  room_id: z.string().uuid().nullable().optional(),
  asset_type_id: z.string().uuid().optional(),
  manufacturer_name: z.string().max(200).nullable().optional(),
  model_number: z.string().max(200).nullable().optional(),
  serial_number: z.string().max(200).nullable().optional(),
  install_date: z.string().date().nullable().optional(),
});

/**
 * PATCH /api/v1/assets/{id} — assets-prd.md §11. Ordinary field edits
 * only — `status` transitions go through
 * `POST /api/v1/assets/{id}/decommission`, per docs/05-api/
 * resource-conventions.md's guidance that a documented state-machine
 * transition gets its own action endpoint rather than a generic PATCH.
 */
export const PATCH = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = patchAssetSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid asset payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }

    const asset = await updateAsset(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      assetId: context.params.id,
      fields: {
        buildingId: parsed.data.building_id,
        roomId: parsed.data.room_id,
        assetTypeId: parsed.data.asset_type_id,
        manufacturerName: parsed.data.manufacturer_name,
        modelNumber: parsed.data.model_number,
        serialNumber: parsed.data.serial_number,
        installDate: parsed.data.install_date,
      },
    });
    return { data: serializeAsset(asset) };
  },
);

const deleteAssetQuerySchema = z.object({ organization_id: z.string().uuid() });

/**
 * DELETE /api/v1/assets/{id} — soft-delete, distinct from the
 * `decommission` status transition (assets.md business rule 2: a
 * decommissioned Asset stays visible; a soft-deleted one does not — see
 * docs/04-database/soft-deletion.md).
 */
export const DELETE = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const parsed = deleteAssetQuerySchema.safeParse({
      organization_id: new URL(request.url).searchParams.get('organization_id'),
    });
    if (!parsed.success) {
      throw new AppError('bad_request', 'organization_id query parameter is required.');
    }

    const asset = await archiveAsset(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      assetId: context.params.id,
    });
    return { data: serializeAsset(asset) };
  },
);
