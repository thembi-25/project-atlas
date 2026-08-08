import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Typed Postgres connection + Drizzle client, built from a validated
 * DATABASE_URL. See docs/04-database/database-architecture.md — "ORM and
 * access pattern": application code accesses the database exclusively
 * through this client, never raw SQL string concatenation.
 *
 * Connection pooling: Supabase's pooler is used in transaction mode for
 * this (serverless-friendly) client — see
 * docs/02-architecture/container-architecture.md, "Communication patterns".
 */
export function createDatabaseClient(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 10, connect_timeout: 10 });
  return drizzle(client, { schema });
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
