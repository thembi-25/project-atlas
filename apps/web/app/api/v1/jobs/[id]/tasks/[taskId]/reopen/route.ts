import { z } from 'zod';
import { reopenTask } from '@atlas/jobs';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeTask } from '@/lib/jobs-serializers';

const schema = z.object({ organization_id: z.string().uuid() });

export const POST = withApiHandler<unknown, { params: { id: string; taskId: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(json ?? {});
    if (!parsed.success) {
      throw new AppError('validation_error', 'organization_id is required.', [
        { field: 'organization_id', issue: 'required' },
      ]);
    }
    const task = await reopenTask(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      jobId: context.params.id,
      taskId: context.params.taskId,
    });
    return { data: serializeTask(task) };
  },
);
