import { z } from 'zod';
import { cancelJob } from '@atlas/jobs';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeJob } from '@/lib/jobs-serializers';

/** POST /api/v1/jobs/{id}/cancel — jobs.md business rule 5: cancellation requires a reason code. */
const schema = z.object({
  organization_id: z.string().uuid(),
  reason: z.string().min(1).max(2000),
});

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'A reason is required to cancel a Job.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const job = await cancelJob(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      jobId: context.params.id,
      reason: parsed.data.reason,
    });
    return { data: serializeJob(job) };
  },
);
