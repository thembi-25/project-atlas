import { schema, withServiceContext } from '@atlas/database';
import {
  verifyStripeWebhookSignature,
  WebhookSignatureVerificationError,
} from '@atlas/integrations';
import { getDb } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { logger } from '@/lib/logger';

/**
 * POST /api/v1/webhooks/stripe — docs/05-api/webhooks.md's mandated
 * pattern: (1) verify the provider signature against the *raw* body
 * before parsing anything, (2) persist the raw verified event durably,
 * keyed by Stripe's own event id for at-least-once-delivery dedup, (3)
 * hand off processing to the Background Worker — never inline here —
 * (4) respond 200 promptly once durably persisted. See ADR-018,
 * `apps/worker`'s `stripe-webhook-poller.ts` for the actual processing.
 */
export const POST = withApiHandler(async (request) => {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    throw new AppError('bad_request', 'Missing stripe-signature header.');
  }

  let event;
  try {
    event = verifyStripeWebhookSignature(rawBody, signature);
  } catch (error) {
    if (error instanceof WebhookSignatureVerificationError) {
      logger.warn('Rejected Stripe webhook with invalid signature', { error: error.message });
      throw new AppError('bad_request', 'Invalid webhook signature.');
    }
    throw error;
  }

  await withServiceContext(getDb(), (tx) =>
    tx
      .insert(schema.stripeWebhookEvents)
      .values({
        stripeEventId: event.id,
        eventType: event.type,
        payload: event as unknown as Record<string, unknown>,
      })
      .onConflictDoNothing({ target: schema.stripeWebhookEvents.stripeEventId }),
  );

  return { data: { received: true } };
});
