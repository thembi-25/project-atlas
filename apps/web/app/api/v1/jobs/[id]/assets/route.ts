import { z } from 'zod';
import { attachAssetToJob, listAssetsForJob } from '@atlas/jobs';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeJobAsset } from '@/lib/jobs-serializers';

export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const jobAssets = await listAssetsForJob(getDb(), {
    organizationId,
    actorUserId: actor.id,
    jobId: context.params.id,
  });
  return { data: jobAssets.map(serializeJobAsset) };
});

const attachSchema = z.object({ organization_id: z.string().uuid(), asset_id: z.string().uuid() });

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = attachSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const jobAsset = await attachAssetToJob(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      jobId: context.params.id,
      assetId: parsed.data.asset_id,
    });
    return { data: serializeJobAsset(jobAsset), status: 201 };
  },
);
