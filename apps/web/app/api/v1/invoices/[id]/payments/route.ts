import { z } from 'zod';
import { capturePayment, listInvoicePayments } from '@atlas/financials';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializePayment } from '@/lib/financials-serializers';

const PAYMENT_METHODS = ['card', 'ach', 'cash', 'check', 'other'] as const;

/** GET /api/v1/invoices/{id}/payments — payments.md, "API requirements": "read endpoints scoped to Invoice/Job/Customer." */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const payments = await listInvoicePayments(getDb(), {
    organizationId,
    actorUserId: actor.id,
    invoiceId: context.params.id,
  });
  return { data: payments.map(serializePayment) };
});

/** POST /api/v1/invoices/{id}/payments — payments.md: capture endpoint requiring an Idempotency-Key. */
const captureSchema = z.object({
  organization_id: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(PAYMENT_METHODS),
  idempotency_key: z.string().min(1).max(200),
});

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = captureSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid payment payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const result = await capturePayment(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      invoiceId: context.params.id,
      amount: parsed.data.amount,
      method: parsed.data.method,
      idempotencyKey: parsed.data.idempotency_key,
    });
    return {
      data: {
        payment: serializePayment(result.payment),
        stripe_client_secret: result.stripeClientSecret ?? null,
      },
      status: 201,
    };
  },
);
