import PgBoss from 'pg-boss';
import { validateServerEnv } from '@atlas/config';
import { createDatabaseClient, type DatabaseClient } from '@atlas/database';
import { REFRESH_INTERVAL_MS } from '@atlas/analytics';
import { logger } from './logger';
import {
  DOMAIN_EVENT_QUEUES,
  dispatchPendingDomainEvents,
  ensureDomainEventQueues,
} from './domain-events-dispatcher';
import { handleJobCompleted, type JobCompletedEventData } from './handlers/job-completed';
import { handleJobCompletedNotifications } from './handlers/job-completed-notify';
import { handleJobDispatchedNotifications, type JobDispatchedEventData } from './handlers/job-dispatched';
import {
  handleEstimateApprovedNotifications,
  type EstimateApprovedEventData,
} from './handlers/estimate-approved';
import { handleInvoiceFinalized, type InvoiceFinalizedEventData } from './handlers/invoice-finalized';
import { handlePaymentReceived, type PaymentReceivedEventData } from './handlers/payment-received';
import { runAnalyticsRefresh } from './handlers/analytics-refresh';
import { processUnhandledStripeWebhookEvents } from './stripe-webhook-poller';

/**
 * Worker entrypoint. Sprint 5 introduced genuine asynchronous processing
 * (docs/13-roadmap/sprint-5.md, ADR-011, ADR-016): the
 * `platform.domain_events` transactional-outbox dispatcher, the
 * `job.completed` consumer, and the Stripe webhook processor. Sprint 7
 * adds Notifications as a real consumer of the full launch-scope event
 * catalog, a QuickBooks sync consumer on `invoice.finalized`/
 * `payment.received`, and a scheduled Analytics materialized-view
 * refresh. pg-boss allows only one `boss.work` handler per queue, so
 * `job.completed` (which now has two independent consumers — Financials'
 * auto-invoice and Notifications) is one registration calling both
 * handlers in sequence; `invoice.finalized`/`payment.received` combine
 * their two consumers (Notifications, QuickBooks sync) inside their own
 * handler function instead, since both need the same fetched Invoice/
 * Payment data. All pollers run on plain `setInterval` — a single,
 * always-on Node process (ADR-016: "not serverless"), so a lightweight
 * in-process poll loop is simpler than a second scheduling layer for
 * this sprint's volume.
 */
const DOMAIN_EVENTS_POLL_INTERVAL_MS = 5000;
const STRIPE_WEBHOOK_POLL_INTERVAL_MS = 5000;
const ANALYTICS_REFRESH_INTERVAL_MS = REFRESH_INTERVAL_MS;

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

  await boss.work<JobDispatchedEventData>('job.dispatched', async (jobs) => {
    for (const job of jobs) {
      await handleJobDispatchedNotifications(db, job.data);
    }
  });

  await boss.work<JobCompletedEventData>('job.completed', async (jobs) => {
    for (const job of jobs) {
      await handleJobCompleted(db, job.data);
      await handleJobCompletedNotifications(db, job.data);
    }
  });

  await boss.work<EstimateApprovedEventData>('estimate.approved', async (jobs) => {
    for (const job of jobs) {
      await handleEstimateApprovedNotifications(db, job.data);
    }
  });

  await boss.work<InvoiceFinalizedEventData>('invoice.finalized', async (jobs) => {
    for (const job of jobs) {
      await handleInvoiceFinalized(db, job.data);
    }
  });

  await boss.work<PaymentReceivedEventData>('payment.received', async (jobs) => {
    for (const job of jobs) {
      await handlePaymentReceived(db, job.data);
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

  const analyticsRefreshTimer = setInterval(() => {
    runAnalyticsRefresh(db).catch((error: unknown) => {
      logger.error('Analytics refresh loop failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, ANALYTICS_REFRESH_INTERVAL_MS);

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
      clearInterval(analyticsRefreshTimer);
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
