import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ResendWebhookSignatureVerificationError, verifyResendWebhookSignature } from './webhook';

describe('verifyResendWebhookSignature', () => {
  const originalSecret = process.env.RESEND_WEBHOOK_SECRET;

  beforeEach(() => {
    delete process.env.RESEND_WEBHOOK_SECRET;
  });

  afterEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = originalSecret;
  });

  it('throws when RESEND_WEBHOOK_SECRET is not configured', () => {
    expect(() =>
      verifyResendWebhookSignature('{}', { svixId: 'id', svixTimestamp: '1', svixSignature: 'v1,sig' }),
    ).toThrow('RESEND_WEBHOOK_SECRET is not configured');
  });

  it('accepts a correctly-computed signature', () => {
    const secretBytes = Buffer.from('fakesecretbytesforunittest');
    process.env.RESEND_WEBHOOK_SECRET = `whsec_${secretBytes.toString('base64')}`;

    const rawBody = JSON.stringify({ type: 'email.bounced' });
    const svixId = 'msg_test';
    const svixTimestamp = '1700000000';
    const signature = createHmac('sha256', secretBytes)
      .update(`${svixId}.${svixTimestamp}.${rawBody}`)
      .digest('base64');

    const result = verifyResendWebhookSignature(rawBody, {
      svixId,
      svixTimestamp,
      svixSignature: `v1,${signature}`,
    });

    expect(result).toEqual({ type: 'email.bounced' });
  });

  it('rejects a mismatched signature', () => {
    process.env.RESEND_WEBHOOK_SECRET = `whsec_${Buffer.from('fakesecretbytesforunittest').toString('base64')}`;
    expect(() =>
      verifyResendWebhookSignature('{}', {
        svixId: 'msg_test',
        svixTimestamp: '1700000000',
        svixSignature: 'v1,bm90YXJlYWxzaWduYXR1cmU=',
      }),
    ).toThrow(ResendWebhookSignatureVerificationError);
  });
});
