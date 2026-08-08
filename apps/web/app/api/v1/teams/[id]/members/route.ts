import { z } from 'zod';
import { addMemberToTeam, findTeamById } from '@atlas/identity';
import { withRequestContext } from '@atlas/database';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';

/** POST /api/v1/teams/{id}/members — Organization PRD §11. */
const addTeamMemberSchema = z.object({
  user_id: z.string().uuid(),
});

export const POST = withApiHandler<
  { team_id: string; user_id: string },
  { params: { id: string } }
>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const teamId = context.params.id;

  const team = await withRequestContext(getDb(), actor.id, (tx) => findTeamById(tx, teamId));
  if (!team) {
    throw new AppError('not_found', 'Team not found');
  }

  const json = await request.json().catch(() => null);
  const parsed = addTeamMemberSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'Invalid team member payload.',
      parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
    );
  }

  await addMemberToTeam(getDb(), {
    organizationId: team.organizationId,
    actorUserId: actor.id,
    teamId,
    userId: parsed.data.user_id,
  });

  return { data: { team_id: teamId, user_id: parsed.data.user_id }, status: 201 };
});
