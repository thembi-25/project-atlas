import { eq } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export async function findRoleByName(
  tx: DatabaseClient,
  name: string,
): Promise<typeof schema.roles.$inferSelect | undefined> {
  const [role] = await tx.select().from(schema.roles).where(eq(schema.roles.name, name)).limit(1);
  return role;
}

export async function listRoles(tx: DatabaseClient): Promise<(typeof schema.roles.$inferSelect)[]> {
  return tx.select().from(schema.roles);
}
