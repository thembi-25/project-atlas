import { getStripeClient } from './client';

/** Refund creation — payments.md business rule 3: refunds are recorded as a new, linked Payment record in Atlas's own data model; this function only performs the Stripe-side refund that record represents. */
export interface CreateRefundParams {
  paymentIntentId: string;
  amountCents: number;
  idempotencyKey: string;
}

export interface RefundResult {
  id: string;
  status: string | null;
}

export async function createRefund(params: CreateRefundParams): Promise<RefundResult> {
  const stripe = getStripeClient();
  const refund = await stripe.refunds.create(
    {
      payment_intent: params.paymentIntentId,
      amount: params.amountCents,
    },
    { idempotencyKey: params.idempotencyKey },
  );

  return { id: refund.id, status: refund.status };
}
