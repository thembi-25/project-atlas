/**
 * Third-party integration clients — see ADR-019. Stripe (Sprint 5),
 * Resend/Twilio/QuickBooks (Sprint 7). Other packages/apps import only
 * from here, never reach into src/<provider>/* directly —
 * docs/08-engineering/project-structure.md, "Rule: no cross-package deep
 * imports."
 */
export { getStripeClient, resetStripeClientForTests } from './stripe/client';
export { createPaymentIntent, retrievePaymentIntent } from './stripe/payment-intents';
export type { CreatePaymentIntentParams, PaymentIntentResult } from './stripe/payment-intents';
export { createRefund } from './stripe/refunds';
export type { CreateRefundParams, RefundResult } from './stripe/refunds';
export { verifyStripeWebhookSignature, WebhookSignatureVerificationError } from './stripe/webhook';
export type { StripeWebhookEvent } from './stripe/webhook';

export { getResendClient, resetResendClientForTests } from './resend/client';
export { sendEmail, EmailSendError } from './resend/send-email';
export type { SendEmailParams, SendEmailResult } from './resend/send-email';
export {
  verifyResendWebhookSignature,
  ResendWebhookSignatureVerificationError,
} from './resend/webhook';
export type { ResendWebhookHeaders } from './resend/webhook';

export { getTwilioClient, resetTwilioClientForTests } from './twilio/client';
export { sendSms, SmsSendError } from './twilio/send-sms';
export type { SendSmsParams, SendSmsResult } from './twilio/send-sms';
export {
  verifyTwilioWebhookSignature,
  TwilioWebhookSignatureVerificationError,
} from './twilio/webhook';

export {
  getQuickBooksOAuthConfig,
  buildQuickBooksAuthorizationUrl,
  exchangeQuickBooksAuthorizationCode,
  refreshQuickBooksAccessToken,
  revokeQuickBooksToken,
  QuickBooksOAuthError,
} from './quickbooks/client';
export type { QuickBooksOAuthConfig, QuickBooksTokenResult } from './quickbooks/client';
export { createQuickBooksInvoice, recordQuickBooksPayment, QuickBooksApiError } from './quickbooks/api-client';
export type {
  QuickBooksLineItem,
  CreateQuickBooksInvoiceParams,
  QuickBooksInvoiceResult,
  RecordQuickBooksPaymentParams,
  QuickBooksPaymentResult,
} from './quickbooks/api-client';
