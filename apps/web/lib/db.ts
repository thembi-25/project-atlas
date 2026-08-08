import { createDatabaseClient, type DatabaseClient } from '@atlas/database';
import { getServerEnv } from './env';

/**
 * Memoized, process-wide Drizzle client for route handlers — see
 * docs/04-database/database-architecture.md, "ORM and access pattern."
 * Route handlers never construct their own `postgres()` connection.
 */
let cachedDb: DatabaseClient | undefined;

export function getDb(): DatabaseClient {
  cachedDb ??= createDatabaseClient(getServerEnv().DATABASE_URL);
  return cachedDb;
}
