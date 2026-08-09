import { z } from 'zod';
import { completeTask } from '@atlas/jobs';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeTask } from '@/lib/jobs-serializers';

/** POST /api/v1/jobs/{id}/tasks/{taskId}/complete — tasks.md business rule 4: individually attributable completion. */
const schema = z.object({
  organization_id: z.string().uuid(),
  response_value: z.unknown().optional(),
  override_reason: z.string().max(2000).optional(),
});

export const POST = withApiHandler<unknown, { params: { id: string; taskId: string } }>(
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
    const task = await completeTask(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      jobId: context.params.id,
      taskId: context.params.taskId,
      responseValue: parsed.data.response_value,
      overrideReason: parsed.data.override_reason,
    });
    return { data: serializeTask(task) };
  },
);
