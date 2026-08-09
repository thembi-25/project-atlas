import { z } from 'zod';
import { completeJob } from '@atlas/jobs';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeJob } from '@/lib/jobs-serializers';

/**
 * POST /api/v1/jobs/{id}/complete — jobs.md#state-machine: `in_progress`
 * -> `completed`. jobs-prd.md §16: rejected with `422` when a required
 * Task is incomplete and not overridden (see @atlas/jobs's
 * `IncompleteRequiredTasksError`, mapped in apps/web/lib/jobs-errors.ts).
 */
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
    const job = await completeJob(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      jobId: context.params.id,
    });
    return { data: serializeJob(job) };
  },
);
