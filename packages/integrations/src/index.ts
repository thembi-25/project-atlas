/**
 * Third-party integration clients — see ADR-018. Currently: Stripe only.
 * Other packages/apps import only from here, never reach into
 * src/stripe/* directly — docs/08-engineering/project-structure.md,
 * "Rule: no cross-package deep imports."
 */
export { getStripeClient, resetStripeClientForTests } from './stripe/client';
export { createPaymentIntent, retrievePaymentIntent } from './stripe/payment-intents';
export type { CreatePaymentIntentParams, PaymentIntentResult } from './stripe/payment-intents';
export { createRefund } from './stripe/refunds';
export type { CreateRefundParams, RefundResult } from './stripe/refunds';
export { verifyStripeWebhookSignature, WebhookSignatureVerificationError } from './stripe/webhook';
export type { StripeWebhookEvent } from './stripe/webhook';
