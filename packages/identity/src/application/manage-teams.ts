import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { NotFoundError } from '../domain/errors';
import {
  findActiveMembershipByOrgAndUser,
  listRoleNamesForMembership,
} from '../infrastructure/memberships';
import { addTeamMember, findTeamById, insertTeam } from '../infrastructure/teams';

/** Organization PRD §12: "Owner/Admin: full read/write on... Teams." */
const ROLES_ALLOWED_TO_MANAGE_TEAMS = ['owner', 'admin'];

async function requireManagerMembership(
  tx: Parameters<typeof findActiveMembershipByOrgAndUser>[0],
  organizationId: string,
  actorUserId: string,
): Promise<void> {
  const actorMembership = await findActiveMembershipByOrgAndUser(tx, organizationId, actorUserId);
  if (!actorMembership) {
    throw new NotFoundError('Organization');
  }
  const actorRoleNames = await listRoleNamesForMembership(tx, actorMembership.id);
  if (!actorRoleNames.some((name) => ROLES_ALLOWED_TO_MANAGE_TEAMS.includes(name))) {
    throw new NotFoundError('Organization'); // 404, not 403 — docs/05-api/authorization.md
  }
}

export interface CreateTeamParams {
  organizationId: string;
  actorUserId: string;
  name: string;
}

export async function createTeam(
  db: DatabaseClient,
  params: CreateTeamParams,
): Promise<{ teamId: string }> {
  const team = await withRequestContext(db, params.actorUserId, async (tx) => {
    await requireManagerMembership(tx, params.organizationId, params.actorUserId);
    return insertTeam(tx, { organizationId: params.organizationId, name: params.name });
  });
  return { teamId: team.id };
}

export interface AddTeamMemberParams {
  organizationId: string;
  actorUserId: string;
  teamId: string;
  userId: string;
}

export async function addMemberToTeam(
  db: DatabaseClient,
  params: AddTeamMemberParams,
): Promise<void> {
  await withRequestContext(db, params.actorUserId, async (tx) => {
    await requireManagerMembership(tx, params.organizationId, params.actorUserId);
    const team = await findTeamById(tx, params.teamId);
    if (!team || team.organizationId !== params.organizationId) {
      throw new NotFoundError('Team');
    }
    const memberMembership = await findActiveMembershipByOrgAndUser(
      tx,
      params.organizationId,
      params.userId,
    );
    if (!memberMembership) {
      throw new NotFoundError('Membership');
    }
    await addTeamMember(tx, { teamId: params.teamId, userId: params.userId });
  });
}
