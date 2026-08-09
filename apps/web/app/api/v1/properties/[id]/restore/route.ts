import { z } from 'zod';
import { restoreProperty } from '@atlas/properties';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeProperty } from '@/lib/properties-serializers';

const restorePropertySchema = z.object({ organization_id: z.string().uuid() });

/**
 * POST /api/v1/properties/{id}/restore — docs/04-database/soft-deletion.md
 * rule 4: a supported, audited, Admin/Owner-only operation. Non-CRUD
 * action as a `POST` sub-path verb per
 * docs/05-api/resource-conventions.md.
 */
export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = restorePropertySchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid restore payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }

    const property = await restoreProperty(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      propertyId: context.params.id,
    });
    return { data: serializeProperty(property) };
  },
);
