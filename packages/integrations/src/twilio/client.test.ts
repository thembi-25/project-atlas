import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getTwilioClient, resetTwilioClientForTests } from './client';

describe('getTwilioClient', () => {
  const originalSid = process.env.TWILIO_ACCOUNT_SID;
  const originalToken = process.env.TWILIO_AUTH_TOKEN;

  beforeEach(() => {
    resetTwilioClientForTests();
  });

  afterEach(() => {
    process.env.TWILIO_ACCOUNT_SID = originalSid;
    process.env.TWILIO_AUTH_TOKEN = originalToken;
    resetTwilioClientForTests();
  });

  it('throws a clear error when TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN are not configured', () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    expect(() => getTwilioClient()).toThrow('TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN are not configured');
  });

  it('constructs and caches a client once credentials are configured', () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACfakesidforunittestsfakesidfor';
    process.env.TWILIO_AUTH_TOKEN = 'fake_auth_token_for_unit_tests';
    const first = getTwilioClient();
    const second = getTwilioClient();
    expect(first).toBe(second);
  });
});
