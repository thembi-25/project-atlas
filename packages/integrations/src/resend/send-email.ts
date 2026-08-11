import { getResendClient } from './client';

/**
 * Transactional email send — ADR-017, notifications-prd.md. Called only
 * from the Background Worker's Notifications consumer, never inline in a
 * request handler (integration-architecture.md principle 2: email is not
 * on the user-facing critical path). Business logic (which recipients,
 * which template, preference-checking) lives in `@atlas/notifications` —
 * this wrapper is a faithful, business-logic-free mirror of Resend's API,
 * matching `stripe/payment-intents.ts`'s established shape.
 */
export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  providerMessageId: string;
}

export class EmailSendError extends Error {
  constructor(message: string) {
    super(`Resend email send failed: ${message}`);
    this.name = 'EmailSendError';
  }
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const fromAddress = process.env.RESEND_FROM_EMAIL;
  if (!fromAddress) {
    throw new Error('RESEND_FROM_EMAIL is not configured.');
  }

  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    throw new EmailSendError(error.message);
  }
  if (!data) {
    throw new EmailSendError('Resend returned no data for a successful send');
  }

  return { providerMessageId: data.id };
}
