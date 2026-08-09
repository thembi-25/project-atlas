import { z } from 'zod';
import { dispatchJob } from '@atlas/scheduling';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeJob } from '@/lib/jobs-serializers';
import { serializeDispatchEvent } from '@/lib/scheduling-serializers';

/** POST /api/v1/jobs/{id}/dispatch — dispatch-prd.md §11: transitions the Job + creates a `dispatch_events` row. */
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
    const result = await dispatchJob(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      jobId: context.params.id,
    });
    return {
      data: {
        job: serializeJob(result.job),
        dispatch_event: serializeDispatchEvent(result.dispatchEvent),
      },
    };
  },
);
