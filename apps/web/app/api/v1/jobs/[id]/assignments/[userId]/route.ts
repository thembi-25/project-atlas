import { unassignUserFromJob } from '@atlas/jobs';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';

export const DELETE = withApiHandler<unknown, { params: { id: string; userId: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organization_id');
    if (!organizationId) {
      throw new AppError('bad_request', 'organization_id query parameter is required.');
    }
    await unassignUserFromJob(getDb(), {
      organizationId,
      actorUserId: actor.id,
      jobId: context.params.id,
      userId: context.params.userId,
    });
    return { data: { unassigned: true } };
  },
);
