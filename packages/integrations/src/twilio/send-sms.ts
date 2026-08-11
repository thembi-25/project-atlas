import { getTwilioClient } from './client';

/**
 * Transactional SMS send — ADR-017, notifications-prd.md. Called only
 * from the Background Worker's Notifications consumer (integration-
 * architecture.md principle 2). Business logic (recipient resolution,
 * preference-checking, email fallback on invalid number) lives in
 * `@atlas/notifications` — this wrapper is a faithful, business-logic-free
 * mirror of Twilio's API.
 */
export interface SendSmsParams {
  to: string;
  body: string;
}

export interface SendSmsResult {
  providerMessageId: string;
  status: string;
}

export class SmsSendError extends Error {
  constructor(cause: unknown) {
    super(`Twilio SMS send failed: ${String(cause)}`);
    this.name = 'SmsSendError';
  }
}

export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!fromNumber) {
    throw new Error('TWILIO_FROM_NUMBER is not configured.');
  }

  const client = getTwilioClient();
  try {
    const message = await client.messages.create({
      to: params.to,
      from: fromNumber,
      body: params.body,
    });
    return { providerMessageId: message.sid, status: message.status };
  } catch (cause) {
    throw new SmsSendError(cause);
  }
}
