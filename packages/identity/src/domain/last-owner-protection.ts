/**
 * "An Organization always has >= 1 active Owner Membership" — see
 * docs/06-modules/identity-prd.md business rules and error cases (§16:
 * attempting to remove the last Owner Membership -> 409).
 */
export interface OwnerMembershipSummary {
  membershipId: string;
  hasOwnerRole: boolean;
  status: 'invited' | 'active' | 'suspended' | 'removed';
}

/**
 * Given every Membership in an Organization that currently holds the Owner
 * Role, decide whether removing/suspending/demoting `targetMembershipId`
 * would leave the Organization with zero active Owners.
 */
export function wouldRemoveLastActiveOwner(
  ownerMemberships: readonly OwnerMembershipSummary[],
  targetMembershipId: string,
): boolean {
  const activeOwnersExcludingTarget = ownerMemberships.filter(
    (m) => m.hasOwnerRole && m.status === 'active' && m.membershipId !== targetMembershipId,
  );
  return activeOwnersExcludingTarget.length === 0;
}

export class LastOwnerProtectionError extends Error {
  constructor() {
    super('An Organization must always have at least one active Owner Membership.');
    this.name = 'LastOwnerProtectionError';
  }
}
