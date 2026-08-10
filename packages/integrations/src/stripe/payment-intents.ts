import { getStripeClient } from './client';

/**
 * PaymentIntent creation for online/Customer Portal card payments —
 * ADR-018, payments.md. Amounts are in the smallest currency unit
 * (cents for USD), matching Stripe's own API — the numeric(12,2) dollar
 * amount conversion happens at the @atlas/financials call site, keeping
 * this wrapper a faithful, business-logic-free mirror of Stripe's API.
 *
 * `idempotencyKey` is always required, never optional — payments.md
 * business rule: "every Payment creation request carries one, enforced
 * unique, to guarantee a network retry never double-charges."
 */
export interface CreatePaymentIntentParams {
  amountCents: number;
  currency: string;
  invoiceId: string;
  organizationId: string;
  idempotencyKey: string;
}

export interface PaymentIntentResult {
  id: string;
  clientSecret: string | null;
  status: string;
}

export async function createPaymentIntent(
  params: CreatePaymentIntentParams,
): Promise<PaymentIntentResult> {
  const stripe = getStripeClient();
  const intent = await stripe.paymentIntents.create(
    {
      amount: params.amountCents,
      currency: params.currency,
      metadata: {
        invoice_id: params.invoiceId,
        organization_id: params.organizationId,
      },
      automatic_payment_methods: { enabled: true },
    },
    { idempotencyKey: params.idempotencyKey },
  );

  return {
    id: intent.id,
    clientSecret: intent.client_secret,
    status: intent.status,
  };
}

export async function retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult> {
  const stripe = getStripeClient();
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  return {
    id: intent.id,
    clientSecret: intent.client_secret,
    status: intent.status,
  };
}
