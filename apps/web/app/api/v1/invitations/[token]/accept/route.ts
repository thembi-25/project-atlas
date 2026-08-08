import { acceptInvitation } from '@atlas/identity';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { withApiHandler } from '@/lib/route-handler';

/**
 * POST /api/v1/invitations/{token}/accept — Identity PRD §11.
 * The invitee must already be signed in (Supabase Auth) with the account
 * they want to accept the invitation into — see
 * docs/06-modules/identity-prd.md, "invitee completes account setup (or
 * links an existing Atlas identity)."
 */
export const POST = withApiHandler<
  { organization_id: string; membership_id: string },
  { params: { token: string } }
>(async (_request, context) => {
  const invitee = await getAuthenticatedUser();
  const result = await acceptInvitation(getDb(), { token: context.params.token, invitee });
  return {
    data: { organization_id: result.organizationId, membership_id: result.membershipId },
  };
});
