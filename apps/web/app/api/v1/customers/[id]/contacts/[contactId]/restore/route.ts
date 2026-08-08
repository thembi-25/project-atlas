import { z } from 'zod';
import { restoreContact } from '@atlas/crm';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeContact } from '@/lib/crm-serializers';

const restoreContactSchema = z.object({ organization_id: z.string().uuid() });

/** POST /api/v1/customers/{id}/contacts/{contactId}/restore — docs/04-database/soft-deletion.md rule 4. */
export const POST = withApiHandler<unknown, { params: { id: string; contactId: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = restoreContactSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid restore payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }

    const contact = await restoreContact(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      contactId: context.params.contactId,
    });
    return { data: serializeContact(contact) };
  },
);
