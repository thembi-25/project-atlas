import { completePortalLogin } from '@atlas/crm';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { withApiHandler } from '@/lib/route-handler';

/**
 * POST /api/v1/portal/auth/complete — Customer Portal login, step 2.
 * Called after the frontend has already run Supabase's own
 * `auth.verifyOtp({ token_hash, type: 'magiclink' })` client-side,
 * establishing a real, cookie-backed `auth.uid()` session — this route
 * resolves that session (the same `getAuthenticatedUser()` staff routes
 * use; Supabase Auth doesn't distinguish a "staff" vs "Portal" JWT, only
 * Atlas's own `contacts.portal_user_id` linkage does) and links every
 * matching Contact to it.
 */
export const POST = withApiHandler(async () => {
  const actor = await getAuthenticatedUser();
  const result = await completePortalLogin(getDb(), {
    portalUserId: actor.id,
    email: actor.email,
    fullName: actor.fullName,
  });

  return {
    data: {
      contacts: result.contacts.map((contact) => ({
        id: contact.id,
        organization_id: contact.organizationId,
        customer_id: contact.customerId,
        name: contact.name,
      })),
    },
  };
});
