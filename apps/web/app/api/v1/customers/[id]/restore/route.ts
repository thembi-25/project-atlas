import { z } from 'zod';
import { restoreCustomer } from '@atlas/crm';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeCustomer } from '@/lib/crm-serializers';

const restoreCustomerSchema = z.object({ organization_id: z.string().uuid() });

/**
 * POST /api/v1/customers/{id}/restore — docs/04-database/soft-deletion.md
 * rule 4: a supported, audited, Admin/Owner-only operation. Non-CRUD
 * action as a `POST` sub-path verb per
 * docs/05-api/resource-conventions.md.
 */
export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = restoreCustomerSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid restore payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }

    const customer = await restoreCustomer(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      customerId: context.params.id,
    });
    return { data: serializeCustomer(customer) };
  },
);
