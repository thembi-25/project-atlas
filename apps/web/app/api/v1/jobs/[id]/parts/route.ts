import { z } from 'zod';
import { consumePart, listJobParts } from '@atlas/inventory';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeJobPart } from '@/lib/inventory-serializers';

/** GET /api/v1/jobs/{id}/parts — inventory.md: `job_parts`, the Job <-> Inventory Item consumption join. */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const parts = await listJobParts(getDb(), {
    organizationId,
    actorUserId: actor.id,
    jobId: context.params.id,
  });
  return { data: parts.map(serializeJobPart) };
});

/** POST /api/v1/jobs/{id}/parts — inventory-prd.md §11: "consume on Job." Insufficient stock is a warning (200 with a `warning` field), never a hard block — inventory-prd.md §16. */
const schema = z.object({
  organization_id: z.string().uuid(),
  inventory_item_id: z.string().uuid(),
  location_id: z.string().uuid(),
  quantity: z.number().positive(),
});

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid Job Part payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const { jobPart, warning } = await consumePart(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      jobId: context.params.id,
      inventoryItemId: parsed.data.inventory_item_id,
      locationId: parsed.data.location_id,
      quantity: String(parsed.data.quantity),
    });
    return {
      data: { ...serializeJobPart(jobPart), warning: warning ?? null },
      status: 201,
    };
  },
);
