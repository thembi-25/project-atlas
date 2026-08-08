import PgBoss from 'pg-boss';
import { validateServerEnv } from '@atlas/config';
import { logger } from './logger';

/**
 * Worker entrypoint. Sprint 0 scope: validate environment, connect
 * pg-boss, and prove the process starts and stops cleanly. NO job
 * handlers are registered — there are no domain events to process yet
 * (the first ones, e.g. `job.completed`, arrive with the Jobs module in
 * Sprint 4). See docs/02-architecture/event-driven-architecture.md and
 * ADR-016.
 */
export async function startWorker(): Promise<PgBoss> {
  const env = validateServerEnv(process.env);
  const connectionString = env.WORKER_DATABASE_URL || env.DATABASE_URL;

  const boss = new PgBoss({ connectionString });

  boss.on('error', (error) => {
    logger.error('pg-boss error', { error: error.message });
  });

  await boss.start();
  logger.info('Worker started', { hasHandlers: false });

  return boss;
}

async function main(): Promise<void> {
  const boss = await startWorker();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('Worker shutting down', { signal });
    await boss.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

// Only auto-start when run directly (not when imported by tests). ESM-safe
// equivalent of the CommonJS `require.main === module` check.
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((error: unknown) => {
    logger.error('Worker failed to start', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  });
}
