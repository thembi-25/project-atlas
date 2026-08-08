import { z } from 'zod';
import { createContact, listContacts } from '@atlas/crm';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeContact } from '@/lib/crm-serializers';

/** GET /api/v1/customers/{id}/contacts — Customers PRD §11. */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const organizationId = new URL(request.url).searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const contacts = await listContacts(getDb(), {
    organizationId,
    actorUserId: actor.id,
    customerId: context.params.id,
  });
  return { data: contacts.map(serializeContact) };
});

const createContactSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  role_title: z.string().max(200).optional(),
  is_primary: z.boolean().optional(),
  portal_access_enabled: z.boolean().optional(),
});

/** POST /api/v1/customers/{id}/contacts — Customers PRD §11. */
export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = createContactSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid contact payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }

    const contact = await createContact(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      customerId: context.params.id,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      roleTitle: parsed.data.role_title,
      isPrimary: parsed.data.is_primary,
      portalAccessEnabled: parsed.data.portal_access_enabled,
    });
    return { data: serializeContact(contact), status: 201 };
  },
);
