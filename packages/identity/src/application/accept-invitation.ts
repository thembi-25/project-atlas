import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { hashInvitationToken, isInvitationExpired } from '../domain/invitation-token';
import { InvitationTokenInvalidError } from '../domain/errors';
import {
  attachAcceptedUser,
  findMembershipByInvitationTokenHash,
} from '../infrastructure/memberships';
import { upsertUserFromAuth } from '../infrastructure/users';

export interface AcceptInvitationParams {
  token: string;
  invitee: { id: string; email: string; fullName: string };
}

export interface AcceptInvitationResult {
  organizationId: string;
  membershipId: string;
}

/**
 * Accepts an invitation: `invited -> active` — see
 * docs/03-domain/users.md's Membership state machine. Runs under the
 * service-context escape hatch (see packages/database/src/request-
 * context.ts) because the invitee has no active Membership yet for RLS to
 * grant them visibility into the pending row.
 */
export async function acceptInvitation(
  db: DatabaseClient,
  params: AcceptInvitationParams,
): Promise<AcceptInvitationResult> {
  return withServiceContext(
    db,
    async (tx) => {
      const tokenHash = hashInvitationToken(params.token);
      const membership = await findMembershipByInvitationTokenHash(tx, tokenHash);
      if (!membership) {
        throw new InvitationTokenInvalidError('not_found');
      }
      if (membership.status !== 'invited') {
        throw new InvitationTokenInvalidError('already_used');
      }
      if (!membership.invitationExpiresAt || isInvitationExpired(membership.invitationExpiresAt)) {
        throw new InvitationTokenInvalidError('expired');
      }

      await upsertUserFromAuth(tx, params.invitee);
      const accepted = await attachAcceptedUser(tx, membership.id, params.invitee.id);

      return { organizationId: accepted.organizationId, membershipId: accepted.id };
    },
    params.invitee.id,
  );
}
