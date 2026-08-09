import { z } from 'zod';
import { holdJob } from '@atlas/jobs';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeJob } from '@/lib/jobs-serializers';

/** POST /api/v1/jobs/{id}/hold — jobs.md#state-machine: `in_progress` -> `on_hold` ("parts needed, customer unavailable"). */
const schema = z.object({
  organization_id: z.string().uuid(),
  reason: z.string().max(2000).optional(),
});

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(json ?? {});
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const job = await holdJob(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      jobId: context.params.id,
      reason: parsed.data.reason,
    });
    return { data: serializeJob(job) };
  },
);
