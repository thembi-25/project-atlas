import { and, eq } from 'drizzle-orm';
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
