import { eq } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

type User = typeof schema.users.$inferSelect;

export async function findUserById(tx: DatabaseClient, userId: string): Promise<User | undefined> {
  const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return user;
}

export async function findUserByEmail(
  tx: DatabaseClient,
  email: string,
): Promise<User | undefined> {
  const [user] = await tx.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  return user;
}

/**
 * Ensures a `identity.users` row exists for a given Supabase Auth user,
 * mirroring `auth.users.id` — see docs/03-domain/users.md. Idempotent: a
 * second call for the same `id` is a no-op update of `full_name`/`email`
 * rather than a duplicate insert.
 */
export async function upsertUserFromAuth(
  tx: DatabaseClient,
  params: { id: string; email: string; fullName: string },
): Promise<User> {
  const [user] = await tx
    .insert(schema.users)
    .values({ id: params.id, email: params.email, fullName: params.fullName })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: { email: params.email, fullName: params.fullName, updatedAt: new Date() },
    })
    .returning();
  if (!user) {
    throw new Error('Failed to upsert user');
  }
  return user;
}
