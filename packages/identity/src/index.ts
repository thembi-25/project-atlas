/**
 * Identity & Organization domain module — public surface. See
 * docs/13-roadmap/sprint-1.md, docs/03-domain/users.md,
 * docs/03-domain/organization.md, docs/03-domain/roles.md.
 *
 * Other packages/apps import only from here, never from
 * src/{domain,application,infrastructure}/* directly — see
 * docs/08-engineering/project-structure.md, "Rule: no cross-package deep
 * imports."
 */

// Domain
export {
  isValidMembershipTransition,
  assertValidMembershipTransition,
  InvalidMembershipTransitionError,
  type MembershipStatus,
} from './domain/membership-status';
export {
  wouldRemoveLastActiveOwner,
  LastOwnerProtectionError,
  type OwnerMembershipSummary,
} from './domain/last-owner-protection';
export {
  generateInvitationToken,
  hashInvitationToken,
  verifyInvitationToken,
  isInvitationExpired,
  INVITATION_EXPIRY_MS,
  type GeneratedInvitationToken,
} from './domain/invitation-token';
export {
  NotFoundError,
  DuplicateInvitationError,
  InvitationTokenInvalidError,
} from './domain/errors';

// Application use cases
export { createOrganization } from './application/create-organization';
export type {
  CreateOrganizationParams,
  CreateOrganizationResult,
} from './application/create-organization';
export { inviteMember } from './application/invite-member';
export type {
  InviteMemberParams,
  InviteMemberResult,
  InvitationNotifier,
} from './application/invite-member';
export { acceptInvitation } from './application/accept-invitation';
export type {
  AcceptInvitationParams,
  AcceptInvitationResult,
} from './application/accept-invitation';
export {
  suspendMembership,
  reinstateMembership,
  removeMembership,
  changeMembershipRole,
} from './application/update-membership';
export type {
  MembershipTransitionParams,
  ChangeMembershipRoleParams,
} from './application/update-membership';
export { createTeam, addMemberToTeam } from './application/manage-teams';
export type { CreateTeamParams, AddTeamMemberParams } from './application/manage-teams';

// Infrastructure (read-only lookups useful to route handlers building responses)
export { findOrganizationById } from './infrastructure/organizations';
export {
  listMembershipsForOrganization,
  findMembershipById,
  findActiveMembershipByOrgAndUser,
  listRoleNamesForMembership,
} from './infrastructure/memberships';
export { listTeamsForOrganization, findTeamById } from './infrastructure/teams';
export { listRoles } from './infrastructure/roles';
export { hasPermission } from './infrastructure/permissions';
export type { HasPermissionParams } from './infrastructure/permissions';
/**
 * Cross-module write for the Customer Portal (Sprint 5): a Contact's
 * Portal identity is the same `identity.users` primitive as a staff
 * User's — see `packages/crm/src/application/portal-auth.ts`, which is
 * the first caller of this function from outside @atlas/identity itself.
 */
export { upsertUserFromAuth } from './infrastructure/users';
