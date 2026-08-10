import PgBoss from 'pg-boss';
import { validateServerEnv } from '@atlas/config';
import { createDatabaseClient, type DatabaseClient } from '@atlas/database';
import { logger } from './logger';
import {
  DOMAIN_EVENT_QUEUES,
  dispatchPendingDomainEvents,
  ensureDomainEventQueues,
} from './domain-events-dispatcher';
import { handleJobCompleted, type JobCompletedEventData } from './handlers/job-completed';
import { processUnhandledStripeWebhookEvents } from './stripe-webhook-poller';

/**
 * Worker entrypoint. Sprint 5 is the first sprint with genuine
 * asynchronous processing need — see docs/13-roadmap/sprint-5.md,
 * ADR-011, ADR-016: the `platform.domain_events` transactional-outbox
 * dispatcher, the `job.completed` consumer (auto-generates a draft
 * Invoice from an approved Estimate), and the Stripe webhook processor.
 * Both pollers run on plain `setInterval` — this is a single, always-on
 * Node process (ADR-016: "not serverless"), so a lightweight in-process
 * poll loop is simpler than a second scheduling layer for this sprint's
 * volume.
 */
const DOMAIN_EVENTS_POLL_INTERVAL_MS = 5000;
const STRIPE_WEBHOOK_POLL_INTERVAL_MS = 5000;

export interface StartedWorker {
  boss: PgBoss;
  db: DatabaseClient;
  stop: () => Promise<void>;
}

export async function startWorker(): Promise<StartedWorker> {
  const env = validateServerEnv(process.env);
  const connectionString = env.WORKER_DATABASE_URL || env.DATABASE_URL;

  const boss = new PgBoss({ connectionString });
  const db = createDatabaseClient(connectionString);

  boss.on('error', (error) => {
    logger.error('pg-boss error', { error: error.message });
  });

  await boss.start();
  await ensureDomainEventQueues(boss);

  await boss.work<JobCompletedEventData>('job.completed', async (jobs) => {
    for (const job of jobs) {
      await handleJobCompleted(db, job.data);
    }
  });

  const domainEventsTimer = setInterval(() => {
    dispatchPendingDomainEvents(db, boss).catch((error: unknown) => {
      logger.error('Domain events dispatch loop failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, DOMAIN_EVENTS_POLL_INTERVAL_MS);

  const stripeWebhookTimer = setInterval(() => {
    processUnhandledStripeWebhookEvents(db).catch((error: unknown) => {
      logger.error('Stripe webhook processing loop failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, STRIPE_WEBHOOK_POLL_INTERVAL_MS);

  logger.info('Worker started', {
    hasHandlers: true,
    domainEventQueues: DOMAIN_EVENT_QUEUES,
  });

  return {
    boss,
    db,
    stop: async () => {
      clearInterval(domainEventsTimer);
      clearInterval(stripeWebhookTimer);
      await boss.stop();
    },
  };
}

async function main(): Promise<void> {
  const worker = await startWorker();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('Worker shutting down', { signal });
    await worker.stop();
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
