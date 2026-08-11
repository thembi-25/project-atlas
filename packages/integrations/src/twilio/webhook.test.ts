import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TwilioWebhookSignatureVerificationError, verifyTwilioWebhookSignature } from './webhook';

/** Replicates Twilio's own signature algorithm (URL + sorted key||value pairs, HMAC-SHA1, base64) to produce a valid signature for the "accepts" test, independent of the SDK internals under test. */
function computeExpectedSignature(url: string, authToken: string, params: Record<string, string>): string {
  const sortedContent = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac('sha1', authToken).update(sortedContent, 'utf-8').digest('base64');
}

describe('verifyTwilioWebhookSignature', () => {
  const originalToken = process.env.TWILIO_AUTH_TOKEN;

  beforeEach(() => {
    delete process.env.TWILIO_AUTH_TOKEN;
  });

  afterEach(() => {
    process.env.TWILIO_AUTH_TOKEN = originalToken;
  });

  it('throws when TWILIO_AUTH_TOKEN is not configured', () => {
    expect(() => verifyTwilioWebhookSignature('https://example.com/hook', 'sig', {})).toThrow(
      'TWILIO_AUTH_TOKEN is not configured',
    );
  });

  it('accepts a correctly-computed signature', () => {
    process.env.TWILIO_AUTH_TOKEN = 'fake_auth_token_for_unit_tests';
    const url = 'https://atlas.example.com/api/v1/webhooks/twilio';
    const params = { MessageSid: 'SMfake', MessageStatus: 'delivered' };
    const signature = computeExpectedSignature(url, process.env.TWILIO_AUTH_TOKEN, params);

    expect(() => verifyTwilioWebhookSignature(url, signature, params)).not.toThrow();
  });

  it('rejects a mismatched signature', () => {
    process.env.TWILIO_AUTH_TOKEN = 'fake_auth_token_for_unit_tests';
    expect(() =>
      verifyTwilioWebhookSignature('https://atlas.example.com/api/v1/webhooks/twilio', 'bad-signature', {
        MessageSid: 'SMfake',
      }),
    ).toThrow(TwilioWebhookSignatureVerificationError);
  });
});
