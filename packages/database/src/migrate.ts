import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabaseClient } from './client';

/**
 * Applies pending migrations from ./migrations against DATABASE_URL.
 * See docs/04-database/migrations.md and docs/10-devops/database-deployment.md
 * for the full policy (forward-only, additive-first, applied via CI/CD —
 * this script is what CI/CD actually invokes, not a substitute for that
 * pipeline discipline when run manually).
 */
async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. See .env.example.');
    process.exitCode = 1;
    return;
  }

  const db = createDatabaseClient(databaseUrl);
  console.log('Applying migrations from ./migrations ...');
  await migrate(db, { migrationsFolder: './migrations' });
  console.log('Migrations applied successfully.');
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
