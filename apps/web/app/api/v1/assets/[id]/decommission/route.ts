import { z } from 'zod';
import { transitionAssetStatus } from '@atlas/assets';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeAsset } from '@/lib/assets-serializers';

/**
 * POST /api/v1/assets/{id}/decommission — assets-prd.md §11/§18/§9. Marks
 * the Asset `decommissioned` by default; `status: "removed"` is the
 * documented alternative terminal outcome (assets.md, "Key attributes" —
 * status: active, removed, decommissioned) for a caller that wants to
 * distinguish "removed, no replacement recorded yet" from "formally
 * decommissioned." Both are one-way — see @atlas/assets's
 * `canTransitionAssetStatus`.
 */
const decommissionSchema = z.object({
  organization_id: z.string().uuid(),
  status: z.enum(['removed', 'decommissioned']).default('decommissioned'),
});

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => ({}));
    const parsed = decommissionSchema.safeParse(json ?? {});
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid decommission payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }

    const asset = await transitionAssetStatus(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      assetId: context.params.id,
      status: parsed.data.status,
    });
    return { data: serializeAsset(asset) };
  },
);
