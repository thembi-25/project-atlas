import { and, eq, inArray } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

type Team = typeof schema.teams.$inferSelect;

export async function insertTeam(
  tx: DatabaseClient,
  params: { organizationId: string; name: string },
): Promise<Team> {
  const [team] = await tx
    .insert(schema.teams)
    .values({ organizationId: params.organizationId, name: params.name })
    .returning();
  if (!team) {
    throw new Error('Failed to insert team');
  }
  return team;
}

export async function listTeamsForOrganization(
  tx: DatabaseClient,
  organizationId: string,
): Promise<Team[]> {
  return tx.select().from(schema.teams).where(eq(schema.teams.organizationId, organizationId));
}

export async function findTeamById(tx: DatabaseClient, teamId: string): Promise<Team | undefined> {
  const [team] = await tx.select().from(schema.teams).where(eq(schema.teams.id, teamId)).limit(1);
  return team;
}

export async function addTeamMember(
  tx: DatabaseClient,
  params: { teamId: string; userId: string },
): Promise<void> {
  await tx.insert(schema.teamMembers).values({ teamId: params.teamId, userId: params.userId });
}

export async function removeTeamMember(
  tx: DatabaseClient,
  params: { teamId: string; userId: string },
): Promise<void> {
  await tx
    .delete(schema.teamMembers)
    .where(
      and(
        eq(schema.teamMembers.teamId, params.teamId),
        eq(schema.teamMembers.userId, params.userId),
      ),
    );
}

/**
 * Cross-module read for Analytics (Sprint 7): a Dispatcher's "own Team"
 * scope (roles.md, Role-to-module access summary — "Dispatcher: R (own
 * team)") is every Team they're a member of, within the given
 * Organization — see
 * `packages/analytics/src/application/authorize.ts`.
 */
export async function listTeamIdsForUser(
  tx: DatabaseClient,
  organizationId: string,
  userId: string,
): Promise<string[]> {
  const rows = await tx
    .select({ teamId: schema.teamMembers.teamId })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.teamMembers.teamId))
    .where(and(eq(schema.teamMembers.userId, userId), eq(schema.teams.organizationId, organizationId)));
  return rows.map((row) => row.teamId);
}

export async function listUserIdsForTeams(tx: DatabaseClient, teamIds: string[]): Promise<string[]> {
  if (teamIds.length === 0) return [];
  const rows = await tx
    .select({ userId: schema.teamMembers.userId })
    .from(schema.teamMembers)
    .where(inArray(schema.teamMembers.teamId, teamIds));
  return [...new Set(rows.map((row) => row.userId))];
}
