import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { generateInvitationToken } from '../domain/invitation-token';
import { DuplicateInvitationError, NotFoundError } from '../domain/errors';
import {
  assignRoleToMembership,
  findActiveMembershipByOrgAndUser,
  findPendingInvitationByOrgAndEmail,
  insertInvitedMembership,
  listRoleNamesForMembership,
} from '../infrastructure/memberships';
import { findRoleByName } from '../infrastructure/roles';
import { findOrganizationById } from '../infrastructure/organizations';
import { findUserByEmail, findUserById } from '../infrastructure/users';

/**
 * Decoupled from any concrete email provider — Resend integration (ADR-017)
 * is not yet wired at this point in the roadmap. apps/web supplies a real
 * implementation; a console-logging one is used in the meantime, matching
 * this sprint's actual notification scope (see
 * docs/13-roadmap/ROADMAP-DECISION.md).
 */
export interface InvitationNotifier {
  sendInvitation(params: {
    invitedEmail: string;
    organizationName: string;
    invitationToken: string;
    invitedByName: string;
  }): Promise<void>;
}

export interface InviteMemberParams {
  organizationId: string;
  actorUserId: string;
  invitedEmail: string;
  roleName: string;
  jobTitle?: string | undefined;
}

export interface InviteMemberResult {
  membershipId: string;
}

/** Identity PRD §12: "Only Owner/Admin can invite... a Membership." */
const ROLES_ALLOWED_TO_INVITE = ['owner', 'admin'];

export async function inviteMember(
  db: DatabaseClient,
  params: InviteMemberParams,
  notifier: InvitationNotifier,
): Promise<InviteMemberResult> {
  const { membershipId, token, organizationName, invitedByName } = await withRequestContext(
    db,
    params.actorUserId,
    async (tx) => {
      const actorMembership = await findActiveMembershipByOrgAndUser(
        tx,
        params.organizationId,
        params.actorUserId,
      );
      if (!actorMembership) {
        throw new NotFoundError('Organization');
      }
      const actorRoleNames = await listRoleNamesForMembership(tx, actorMembership.id);
      if (!actorRoleNames.some((name) => ROLES_ALLOWED_TO_INVITE.includes(name))) {
        // 404, not 403 — see docs/05-api/authorization.md, "a resource
        // belonging to another Organization returns 404, never 403."
        throw new NotFoundError('Organization');
      }

      const existingUser = await findUserByEmail(tx, params.invitedEmail);
      if (existingUser) {
        const existingActiveMembership = await findActiveMembershipByOrgAndUser(
          tx,
          params.organizationId,
          existingUser.id,
        );
        if (existingActiveMembership) {
          throw new DuplicateInvitationError();
        }
      }
      const existingInvitation = await findPendingInvitationByOrgAndEmail(
        tx,
        params.organizationId,
        params.invitedEmail,
      );
      if (existingInvitation) {
        throw new DuplicateInvitationError();
      }

      const role = await findRoleByName(tx, params.roleName);
      if (!role) {
        throw new NotFoundError('Role');
      }

      const organization = await findOrganizationById(tx, params.organizationId);
      if (!organization) {
        throw new NotFoundError('Organization');
      }
      const actor = await findUserById(tx, params.actorUserId);

      const generated = generateInvitationToken();
      const membership = await insertInvitedMembership(tx, {
        organizationId: params.organizationId,
        invitedEmail: params.invitedEmail,
        invitedByUserId: params.actorUserId,
        invitationTokenHash: generated.tokenHash,
        invitationExpiresAt: generated.expiresAt,
        jobTitle: params.jobTitle,
      });
      await assignRoleToMembership(tx, membership.id, role.id);

      return {
        membershipId: membership.id,
        token: generated.token,
        organizationName: organization.name,
        invitedByName: actor?.fullName ?? 'A teammate',
      };
    },
  );

  // Sent only after the transaction has committed — an email for an
  // invitation that then rolled back would be actively misleading.
  await notifier.sendInvitation({
    invitedEmail: params.invitedEmail,
    organizationName,
    invitationToken: token,
    invitedByName,
  });

  return { membershipId };
}
