import { getJobHistory } from '@atlas/jobs';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import {
  serializeJob,
  serializeJobAssignment,
  serializeJobStatusHistoryEntry,
  serializeTask,
} from '@/lib/jobs-serializers';

/** GET /api/v1/jobs/{id}/history — jobs-prd.md §13: status transitions, checklist state, current assignment. */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const result = await getJobHistory(getDb(), {
    organizationId,
    actorUserId: actor.id,
    jobId: context.params.id,
  });
  return {
    data: {
      job: serializeJob(result.job),
      status_history: result.statusHistory.map(serializeJobStatusHistoryEntry),
      tasks: result.tasks.map(serializeTask),
      assignments: result.assignments.map(serializeJobAssignment),
    },
  };
});
