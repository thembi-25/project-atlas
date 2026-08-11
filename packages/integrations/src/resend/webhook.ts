import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Inbound Resend webhook (bounce/complaint/delivery events) signature
 * verification — integration-architecture.md principle 4: "verify
 * provider signature before parsing body." Resend signs webhooks using
 * the Svix scheme (https://docs.svix.com/receiving/verifying-payloads/how-manual):
 * `svix-id` + `.` + `svix-timestamp` + `.` + raw body, HMAC-SHA256'd with
 * the base64-decoded webhook secret, compared against the base64
 * signature(s) in `svix-signature` (space-separated `v1,<sig>` entries —
 * Resend only ever sends one). Implemented directly against Node's
 * `crypto` rather than pulling in the `svix` package for one verification
 * function.
 */
export class ResendWebhookSignatureVerificationError extends Error {
  constructor(reason: string) {
    super(`Resend webhook signature verification failed: ${reason}`);
    this.name = 'ResendWebhookSignatureVerificationError';
  }
}

export interface ResendWebhookHeaders {
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
}

export function verifyResendWebhookSignature(
  rawBody: string,
  headers: ResendWebhookHeaders,
): unknown {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('RESEND_WEBHOOK_SECRET is not configured.');
  }

  const secretBytes = Buffer.from(webhookSecret.replace(/^whsec_/, ''), 'base64');
  const signedContent = `${headers.svixId}.${headers.svixTimestamp}.${rawBody}`;
  const expectedSignature = createHmac('sha256', secretBytes).update(signedContent).digest('base64');
  const expectedBuffer = Buffer.from(expectedSignature, 'base64');

  const providedSignatures = headers.svixSignature
    .split(' ')
    .map((entry) => entry.split(',')[1])
    .filter((sig): sig is string => Boolean(sig));

  const matched = providedSignatures.some((sig) => {
    const providedBuffer = Buffer.from(sig, 'base64');
    return (
      providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer)
    );
  });

  if (!matched) {
    throw new ResendWebhookSignatureVerificationError('no matching signature in svix-signature header');
  }

  return JSON.parse(rawBody);
}
