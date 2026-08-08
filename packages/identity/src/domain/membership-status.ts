/**
 * Membership status state machine — see docs/03-domain/users.md.
 *
 *   invited -> active     (invitation accepted)
 *   active -> suspended   (Admin suspends access)
 *   suspended -> active   (Admin reinstates)
 *   active -> removed     (Admin removes / user leaves)
 *   suspended -> removed  (Admin removes)
 *   invited -> removed    (invitation revoked)
 */
export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'removed';

const ALLOWED_TRANSITIONS: Record<MembershipStatus, readonly MembershipStatus[]> = {
  invited: ['active', 'removed'],
  active: ['suspended', 'removed'],
  suspended: ['active', 'removed'],
  removed: [],
};

export function isValidMembershipTransition(from: MembershipStatus, to: MembershipStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidMembershipTransitionError extends Error {
  constructor(from: MembershipStatus, to: MembershipStatus) {
    super(`Cannot transition Membership from '${from}' to '${to}'`);
    this.name = 'InvalidMembershipTransitionError';
  }
}

export function assertValidMembershipTransition(
  from: MembershipStatus,
  to: MembershipStatus,
): void {
  if (!isValidMembershipTransition(from, to)) {
    throw new InvalidMembershipTransitionError(from, to);
  }
}
