import { validateRequest } from 'twilio';

/**
 * Inbound Twilio webhook (delivery-status callback) signature verification
 * — integration-architecture.md principle 4. Twilio signs the full
 * request URL plus sorted form params with the Auth Token
 * (`X-Twilio-Signature` header); the SDK's own `validateRequest` helper
 * implements that exactly, so this wraps it rather than reimplementing it
 * (unlike Resend, which ships no first-party verification helper).
 */
export class TwilioWebhookSignatureVerificationError extends Error {
  constructor() {
    super('Twilio webhook signature verification failed');
    this.name = 'TwilioWebhookSignatureVerificationError';
  }
}

export function verifyTwilioWebhookSignature(
  requestUrl: string,
  signatureHeader: string,
  params: Record<string, string>,
): void {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    throw new Error('TWILIO_AUTH_TOKEN is not configured.');
  }

  const isValid = validateRequest(authToken, signatureHeader, requestUrl, params);
  if (!isValid) {
    throw new TwilioWebhookSignatureVerificationError();
  }
}
