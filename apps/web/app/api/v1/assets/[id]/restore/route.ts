import { z } from 'zod';
import { restoreAsset } from '@atlas/assets';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeAsset } from '@/lib/assets-serializers';

const restoreAssetSchema = z.object({ organization_id: z.string().uuid() });

/**
 * POST /api/v1/assets/{id}/restore — docs/04-database/soft-deletion.md
 * rule 4: a supported, audited, Admin/Owner-only operation, mirroring
 * the Customer/Property restore precedent.
 */
export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = restoreAssetSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid restore payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }

    const asset = await restoreAsset(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      assetId: context.params.id,
    });
    return { data: serializeAsset(asset) };
  },
);
