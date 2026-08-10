import { z } from 'zod';
import { capturePaymentAsPortalContact } from '@atlas/financials';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializePayment } from '@/lib/financials-serializers';

/** POST /api/v1/portal/invoices/{id}/pay — Customer Portal Invoice payment view, card only. Returns a Stripe `client_secret` for the frontend to confirm via Stripe's client-side SDK; the Payment stays `pending` until the webhook confirms it (ADR-018). */
const schema = z.object({
  amount: z.number().positive(),
  idempotency_key: z.string().min(1).max(200),
});

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid payment payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const result = await capturePaymentAsPortalContact(getDb(), {
      portalUserId: actor.id,
      invoiceId: context.params.id,
      amount: parsed.data.amount,
      idempotencyKey: parsed.data.idempotency_key,
    });
    return {
      data: {
        payment: serializePayment(result.payment),
        stripe_client_secret: result.stripeClientSecret,
      },
      status: 201,
    };
  },
);
