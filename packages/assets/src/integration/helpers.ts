import { createDatabaseClient, type DatabaseClient } from '@atlas/database';

/**
 * Shared setup for the integration suite — see
 * docs/09-testing/integration-testing.md. Requires a reachable
 * `DATABASE_URL` pointed at a database already migrated to the current
 * schema (see packages/database/migrations/).
 */
export function getIntegrationDb(): DatabaseClient {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set — see docs/13-roadmap/SPRINT-3-COMPLETION-REPORT.md for how to run this suite.',
    );
  }
  return createDatabaseClient(databaseUrl);
}

let counter = 0;
/** A collision-safe unique suffix for test-data names/emails within a single run. */
export function uniqueSuffix(): string {
  counter += 1;
  return `${Date.now()}-${counter}`;
}
