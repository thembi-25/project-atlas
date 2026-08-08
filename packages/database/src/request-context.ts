import { sql } from 'drizzle-orm';
import type { DatabaseClient } from './client';

/**
 * Runs `fn` inside a transaction with the acting User's identity set as
 * Postgres session-local state, so RLS policies (which check `auth.uid()`)
 * and the audit trigger (which reads `app.current_user_id` — see
 * docs/04-database/audit-logging.md) both evaluate correctly even though
 * this client connects via a single, service-level `DATABASE_URL` rather
 * than per-user Supabase-issued credentials.
 *
 * `request.jwt.claim.sub` mirrors the field Supabase's own PostgREST layer
 * sets from a verified JWT, which is what `auth.uid()` reads — see
 * docs/04-database/multi-tenancy.md. `SET LOCAL role authenticated` makes
 * the transaction subject to the same RLS policies a real
 * `authenticated`-role Supabase client would be, rather than running as
 * the unrestricted connection owner.
 */
export async function withRequestContext<T>(
  db: DatabaseClient,
  actorUserId: string,
  fn: (tx: DatabaseClient) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claim.sub', ${actorUserId}, true)`);
    await tx.execute(sql`select set_config('app.current_user_id', ${actorUserId}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return fn(tx as unknown as DatabaseClient);
  });
}

/**
 * Runs `fn` inside a transaction using the connection's own elevated
 * privileges (bypassing RLS entirely), for the narrow set of operations
 * that legitimately cannot be scoped to an existing Membership — e.g.
 * bootstrapping a brand-new Organization and its founding Owner Membership
 * atomically, before any Membership row exists to check access against —
 * or accepting an invitation, before the invitee has an active Membership
 * RLS would otherwise let them see. See docs/07-security/tenant-isolation.md
 * and packages/identity/src/application/{create-organization,accept-
 * invitation}.ts for Sprint 1's two reviewed uses of this escape hatch; do
 * not reach for it merely for convenience elsewhere — see
 * docs/04-database/multi-tenancy.md, "No SECURITY DEFINER shortcuts...
 * without an explicit, reviewed justification."
 */
export async function withServiceContext<T>(
  db: DatabaseClient,
  fn: (tx: DatabaseClient) => Promise<T>,
  actorUserId?: string,
): Promise<T> {
  return db.transaction(async (tx) => {
    if (actorUserId) {
      // Attributes audit_events rows to the acting user even though this
      // transaction otherwise runs with the connection's own elevated
      // privileges — see app.current_actor_user_id() in
      // migrations/0001_rls_and_audit_triggers.sql.
      await tx.execute(sql`select set_config('app.current_user_id', ${actorUserId}, true)`);
    }
    return fn(tx as unknown as DatabaseClient);
  });
}
