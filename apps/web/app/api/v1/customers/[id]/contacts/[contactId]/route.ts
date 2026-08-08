import { z } from 'zod';
import { archiveContact, getContact, updateContact } from '@atlas/crm';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeContact } from '@/lib/crm-serializers';

type RouteContext = { params: { id: string; contactId: string } };

/** GET /api/v1/customers/{id}/contacts/{contactId} — Customers PRD §11. */
export const GET = withApiHandler<unknown, RouteContext>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const organizationId = new URL(request.url).searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const contact = await getContact(getDb(), {
    organizationId,
    actorUserId: actor.id,
    contactId: context.params.contactId,
  });
  return { data: serializeContact(contact) };
});

const patchContactSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().nullable().optional(),
  role_title: z.string().max(200).nullable().optional(),
  is_primary: z.boolean().optional(),
  portal_access_enabled: z.boolean().optional(),
});

/**
 * PATCH /api/v1/customers/{id}/contacts/{contactId} — Customers PRD §11.
 * Setting `is_primary: true` unsets any other primary Contact on the same
 * Customer — contacts.md business rule 2.
 */
export const PATCH = withApiHandler<unknown, RouteContext>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const json = await request.json().catch(() => null);
  const parsed = patchContactSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'Invalid contact payload.',
      parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
    );
  }

  const contact = await updateContact(getDb(), {
    organizationId: parsed.data.organization_id,
    actorUserId: actor.id,
    contactId: context.params.contactId,
    fields: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      roleTitle: parsed.data.role_title,
      isPrimary: parsed.data.is_primary,
      portalAccessEnabled: parsed.data.portal_access_enabled,
    },
  });
  return { data: serializeContact(contact) };
});

const deleteContactQuerySchema = z.object({ organization_id: z.string().uuid() });

/**
 * DELETE /api/v1/customers/{id}/contacts/{contactId} — soft-delete.
 * Blocked (409) if this is the Customer's last remaining Contact —
 * contacts.md business rule 1.
 */
export const DELETE = withApiHandler<unknown, RouteContext>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const parsed = deleteContactQuerySchema.safeParse({
    organization_id: new URL(request.url).searchParams.get('organization_id'),
  });
  if (!parsed.success) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }

  const contact = await archiveContact(getDb(), {
    organizationId: parsed.data.organization_id,
    actorUserId: actor.id,
    contactId: context.params.contactId,
  });
  return { data: serializeContact(contact) };
});
