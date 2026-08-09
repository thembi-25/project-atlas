import { z } from 'zod';
import { addAdHocTask, listTasks } from '@atlas/jobs';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeTask } from '@/lib/jobs-serializers';

const TASK_TYPES = ['checkbox', 'text', 'number', 'photo', 'signature', 'select'] as const;

/** GET /api/v1/jobs/{id}/tasks — jobs-prd.md §11. */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const tasks = await listTasks(getDb(), {
    organizationId,
    actorUserId: actor.id,
    jobId: context.params.id,
  });
  return { data: tasks.map(serializeTask) };
});

/** POST /api/v1/jobs/{id}/tasks — jobs.md business rule 2: staff may add ad hoc Tasks. */
const addTaskSchema = z.object({
  organization_id: z.string().uuid(),
  label: z.string().min(1).max(500),
  type: z.enum(TASK_TYPES),
  is_required: z.boolean().optional(),
});

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = addTaskSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid task payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const task = await addAdHocTask(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      jobId: context.params.id,
      label: parsed.data.label,
      type: parsed.data.type,
      isRequired: parsed.data.is_required,
    });
    return { data: serializeTask(task), status: 201 };
  },
);
