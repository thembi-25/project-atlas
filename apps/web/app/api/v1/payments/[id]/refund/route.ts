import { z } from 'zod';
import { refundPayment } from '@atlas/financials';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializePayment } from '@/lib/financials-serializers';

/** POST /api/v1/payments/{id}/refund — payments.md business rule 3: a refund is a new, linked Payment record. Accountant/Admin/Owner only (`payments:refund`). Requires an Idempotency-Key like every capture request. */
const schema = z.object({
  organization_id: z.string().uuid(),
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
        'Invalid refund payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const result = await refundPayment(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      paymentId: context.params.id,
      amount: parsed.data.amount,
      idempotencyKey: parsed.data.idempotency_key,
    });
    return {
      data: {
        original_payment: serializePayment(result.originalPayment),
        refund_payment: serializePayment(result.refundPayment),
      },
      status: 201,
    };
  },
);
