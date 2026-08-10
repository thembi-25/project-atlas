import { getPortalContacts } from '@atlas/crm';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { withApiHandler } from '@/lib/route-handler';

/** GET /api/v1/portal/me — the Contact(s) this Portal session is linked to, across every Organization. */
export const GET = withApiHandler(async () => {
  const actor = await getAuthenticatedUser();
  const contacts = await getPortalContacts(getDb(), { portalUserId: actor.id });
  return {
    data: contacts.map((contact) => ({
      id: contact.id,
      organization_id: contact.organizationId,
      customer_id: contact.customerId,
      name: contact.name,
    })),
  };
});
