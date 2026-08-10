import { z } from 'zod';
import { voidInvoice } from '@atlas/financials';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeInvoice } from '@/lib/financials-serializers';

/** POST /api/v1/invoices/{id}/void — invoices.md business rule 1: only permitted before any Payment has been applied. */
const schema = z.object({
  organization_id: z.string().uuid(),
  reason: z.string().min(1).max(1000),
});

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid void payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const invoice = await voidInvoice(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      invoiceId: context.params.id,
      reason: parsed.data.reason,
    });
    return { data: serializeInvoice(invoice) };
  },
);
