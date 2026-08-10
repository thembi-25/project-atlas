import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getStripeClient, resetStripeClientForTests } from './client';

describe('getStripeClient', () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    resetStripeClientForTests();
  });

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = originalKey;
    resetStripeClientForTests();
  });

  it('throws a clear error when STRIPE_SECRET_KEY is not configured', () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(() => getStripeClient()).toThrow('STRIPE_SECRET_KEY is not configured');
  });

  it('constructs and caches a client once a key is configured', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_unit_tests';
    const first = getStripeClient();
    const second = getStripeClient();
    expect(first).toBe(second);
  });
});
