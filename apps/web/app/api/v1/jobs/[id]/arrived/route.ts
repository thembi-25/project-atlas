import { z } from 'zod';
import { markArrived } from '@atlas/scheduling';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeDispatchEvent } from '@/lib/scheduling-serializers';

/** POST /api/v1/jobs/{id}/arrived — dispatch-prd.md §11: Technician marks arrival on site. */
const schema = z.object({ organization_id: z.string().uuid() });

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(json ?? {});
    if (!parsed.success) {
      throw new AppError('validation_error', 'organization_id is required.', [
        { field: 'organization_id', issue: 'required' },
      ]);
    }
    const event = await markArrived(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      jobId: context.params.id,
    });
    return { data: serializeDispatchEvent(event) };
  },
);
