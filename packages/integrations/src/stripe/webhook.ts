import Stripe from 'stripe';
import { getStripeClient } from './client';

/**
 * Inbound Stripe webhook signature verification — docs/05-api/webhooks.md's
 * mandated pattern: "verify provider signature before parsing body." The
 * caller must pass the *raw*, unparsed request body (signature
 * verification fails against a body that's been JSON-parsed and
 * re-serialized, since whitespace/key-order can differ).
 */
export class WebhookSignatureVerificationError extends Error {
  constructor(cause: unknown) {
    super(`Stripe webhook signature verification failed: ${String(cause)}`);
    this.name = 'WebhookSignatureVerificationError';
  }
}

export type StripeWebhookEvent = Stripe.Event;

export function verifyStripeWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string,
): StripeWebhookEvent {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  }

  const stripe = getStripeClient();
  try {
    return stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
  } catch (cause) {
    throw new WebhookSignatureVerificationError(cause);
  }
}
