import { z } from 'zod';
import { convertEstimateToInvoice } from '@atlas/financials';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeEstimate, serializeInvoice } from '@/lib/financials-serializers';

/** POST /api/v1/estimates/{id}/convert — estimates.md#state-machine: `approved` -> `converted`, generating a draft Invoice. Manual staff trigger (`estimates:finalize`); the automatic path (Job completion) is `apps/worker`'s `job.completed` consumer. */
const schema = z.object({
  organization_id: z.string().uuid(),
  due_date: z.string().datetime().optional(),
});

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(json ?? {});
    if (!parsed.success) {
      throw new AppError('validation_error', 'organization_id is required.', [
        { field: 'organization_id', issue: 'required' },
      ]);
    }
    const result = await convertEstimateToInvoice(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      estimateId: context.params.id,
      dueDate: parsed.data.due_date ? new Date(parsed.data.due_date) : undefined,
    });
    return {
      data: {
        estimate: serializeEstimate(result.estimate),
        invoice: serializeInvoice(result.invoice),
      },
      status: 201,
    };
  },
);
