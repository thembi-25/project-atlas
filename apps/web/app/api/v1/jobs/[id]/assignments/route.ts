import { z } from 'zod';
import { assignUserToJob, listAssignmentsForJob } from '@atlas/jobs';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeJobAssignment } from '@/lib/jobs-serializers';

/** GET /api/v1/jobs/{id}/assignments. */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const assignments = await listAssignmentsForJob(getDb(), {
    organizationId,
    actorUserId: actor.id,
    jobId: context.params.id,
  });
  return { data: assignments.map(serializeJobAssignment) };
});

/** POST /api/v1/jobs/{id}/assignments — `jobs:assign`-gated (Dispatcher/Admin/Owner only). */
const assignSchema = z.object({ organization_id: z.string().uuid(), user_id: z.string().uuid() });

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = assignSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid assignment payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const assignment = await assignUserToJob(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      jobId: context.params.id,
      userId: parsed.data.user_id,
    });
    return { data: serializeJobAssignment(assignment), status: 201 };
  },
);
