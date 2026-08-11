import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getResendClient, resetResendClientForTests } from './client';

describe('getResendClient', () => {
  const originalKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    resetResendClientForTests();
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
    resetResendClientForTests();
  });

  it('throws a clear error when RESEND_API_KEY is not configured', () => {
    delete process.env.RESEND_API_KEY;
    expect(() => getResendClient()).toThrow('RESEND_API_KEY is not configured');
  });

  it('constructs and caches a client once a key is configured', () => {
    process.env.RESEND_API_KEY = 're_fake_key_for_unit_tests';
    const first = getResendClient();
    const second = getResendClient();
    expect(first).toBe(second);
  });
});
