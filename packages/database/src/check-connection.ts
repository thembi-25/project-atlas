import postgres from 'postgres';

/**
 * Standalone connectivity check — validates that DATABASE_URL points at a
 * reachable Postgres instance, independent of the full Drizzle client or
 * any application schema. Used by `pnpm db:check` and by Sprint 0
 * validation. See docs/13-roadmap/SPRINT-0-COMPLETION-REPORT.md for the
 * actual result of running this in the current execution environment.
 *
 * Deliberately does not import the Next.js/worker env validation — this is
 * meant to be runnable standalone with just DATABASE_URL set, so it can be
 * used to debug a broken environment before the rest of the app can even
 * validate its config.
 */
async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. See .env.example.');
    process.exitCode = 1;
    return;
  }

  const client = postgres(databaseUrl, { max: 1, connect_timeout: 5 });
  try {
    const result = await client`select 1 as ok`;
    if (result[0]?.ok === 1) {
      console.log('Database connectivity check: OK');
    } else {
      console.error('Database connectivity check: unexpected response', result);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(
      'Database connectivity check: FAILED —',
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  } finally {
    await client.end({ timeout: 5 });
  }
}

void main();
