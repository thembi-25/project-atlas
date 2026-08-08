import { describe, expect, it } from 'vitest';
import { wouldRemoveLastActiveOwner, type OwnerMembershipSummary } from './last-owner-protection';

describe('last-owner protection', () => {
  it('blocks removing the sole active Owner', () => {
    const owners: OwnerMembershipSummary[] = [
      { membershipId: 'm1', hasOwnerRole: true, status: 'active' },
    ];
    expect(wouldRemoveLastActiveOwner(owners, 'm1')).toBe(true);
  });

  it('allows removing an Owner when another active Owner remains', () => {
    const owners: OwnerMembershipSummary[] = [
      { membershipId: 'm1', hasOwnerRole: true, status: 'active' },
      { membershipId: 'm2', hasOwnerRole: true, status: 'active' },
    ];
    expect(wouldRemoveLastActiveOwner(owners, 'm1')).toBe(false);
  });

  it('does not count a suspended or removed Owner as covering the requirement', () => {
    const owners: OwnerMembershipSummary[] = [
      { membershipId: 'm1', hasOwnerRole: true, status: 'active' },
      { membershipId: 'm2', hasOwnerRole: true, status: 'suspended' },
    ];
    expect(wouldRemoveLastActiveOwner(owners, 'm1')).toBe(true);
  });

  it('is true for an Organization with zero Owner Memberships at all (defensive default)', () => {
    expect(wouldRemoveLastActiveOwner([], 'm1')).toBe(true);
  });
});
