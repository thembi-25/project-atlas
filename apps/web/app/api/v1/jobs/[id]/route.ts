import { z } from 'zod';
import { archiveJob, getJob, updateJob } from '@atlas/jobs';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeJob } from '@/lib/jobs-serializers';

export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const job = await getJob(getDb(), {
    organizationId,
    actorUserId: actor.id,
    jobId: context.params.id,
  });
  return { data: serializeJob(job) };
});

/** PATCH /api/v1/jobs/{id} — ordinary field edits only; never `status` (see the dedicated transition endpoints). */
const updateJobSchema = z.object({
  organization_id: z.string().uuid(),
  job_type_id: z.string().uuid().optional(),
  service_category_id: z.string().uuid().nullable().optional(),
  priority: z.enum(['normal', 'urgent', 'emergency']).optional(),
  contact_id: z.string().uuid().nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
});

export const PATCH = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = updateJobSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid job payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const job = await updateJob(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      jobId: context.params.id,
      fields: {
        jobTypeId: parsed.data.job_type_id,
        serviceCategoryId: parsed.data.service_category_id,
        priority: parsed.data.priority,
        contactId: parsed.data.contact_id,
        description: parsed.data.description,
      },
    });
    return { data: serializeJob(job) };
  },
);

const deleteJobSchema = z.object({ organization_id: z.string().uuid() });

export const DELETE = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const url = new URL(request.url);
    const parsed = deleteJobSchema.safeParse({
      organization_id: url.searchParams.get('organization_id'),
    });
    if (!parsed.success) {
      throw new AppError('bad_request', 'organization_id query parameter is required.');
    }
    const job = await archiveJob(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      jobId: context.params.id,
    });
    return { data: serializeJob(job) };
  },
);
