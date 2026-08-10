import { z } from 'zod';
import { issueCreditNote } from '@atlas/financials';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeCreditNote } from '@/lib/financials-serializers';

/** POST /api/v1/invoices/{id}/credit-notes — invoices.md business rule 1: the only way to correct a finalized Invoice's totals without mutating it. Accountant/Admin/Owner only (`invoices:void`). */
const schema = z.object({
  organization_id: z.string().uuid(),
  reason: z.string().min(1).max(1000),
  amount: z.number(),
});

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid credit note payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const creditNote = await issueCreditNote(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      invoiceId: context.params.id,
      reason: parsed.data.reason,
      amount: parsed.data.amount,
    });
    return { data: serializeCreditNote(creditNote), status: 201 };
  },
);
