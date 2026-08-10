import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetStripeClientForTests } from './client';
import { verifyStripeWebhookSignature, WebhookSignatureVerificationError } from './webhook';

describe('verifyStripeWebhookSignature', () => {
  const originalSecretKey = process.env.STRIPE_SECRET_KEY;
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    resetStripeClientForTests();
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_unit_tests';
  });

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = originalSecretKey;
    process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
    resetStripeClientForTests();
  });

  it('throws when STRIPE_WEBHOOK_SECRET is not configured', () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect(() => verifyStripeWebhookSignature('{}', 'sig')).toThrow(
      'STRIPE_WEBHOOK_SECRET is not configured',
    );
  });

  it('wraps a signature mismatch in WebhookSignatureVerificationError, never leaking the raw Stripe error', () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake_secret_for_unit_tests';
    expect(() =>
      verifyStripeWebhookSignature('{"type":"payment_intent.succeeded"}', 'bad-signature'),
    ).toThrow(WebhookSignatureVerificationError);
  });
});
