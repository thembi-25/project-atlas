import { z } from 'zod';
import { createTeam, listTeamsForOrganization } from '@atlas/identity';
import { withRequestContext } from '@atlas/database';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { assertMfaEnrolledForPrivilegedAction } from '@/lib/mfa';

/** GET /api/v1/teams?organization_id={id} — Organization PRD §11. */
export const GET = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const organizationId = new URL(request.url).searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }

  const teams = await withRequestContext(getDb(), actor.id, (tx) =>
    listTeamsForOrganization(tx, organizationId),
  );

  return {
    data: teams.map((team) => ({
      id: team.id,
      organization_id: team.organizationId,
      name: team.name,
      created_at: team.createdAt.toISOString(),
    })),
  };
});

/** POST /api/v1/teams — Organization PRD §11, restricted to Owner/Admin. */
const createTeamSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(200),
});

export const POST = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  await assertMfaEnrolledForPrivilegedAction();
  const json = await request.json().catch(() => null);
  const parsed = createTeamSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'Invalid team payload.',
      parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
    );
  }

  const result = await createTeam(getDb(), {
    organizationId: parsed.data.organization_id,
    actorUserId: actor.id,
    name: parsed.data.name,
  });

  return { data: { id: result.teamId }, status: 201 };
});
