import { describe, expect, it } from 'vitest';
import {
  assertValidMembershipTransition,
  InvalidMembershipTransitionError,
  isValidMembershipTransition,
} from './membership-status';

describe('membership status transitions', () => {
  it('allows the documented transitions', () => {
    expect(isValidMembershipTransition('invited', 'active')).toBe(true);
    expect(isValidMembershipTransition('invited', 'removed')).toBe(true);
    expect(isValidMembershipTransition('active', 'suspended')).toBe(true);
    expect(isValidMembershipTransition('active', 'removed')).toBe(true);
    expect(isValidMembershipTransition('suspended', 'active')).toBe(true);
    expect(isValidMembershipTransition('suspended', 'removed')).toBe(true);
  });

  it('rejects transitions not in the state machine', () => {
    expect(isValidMembershipTransition('invited', 'suspended')).toBe(false);
    expect(isValidMembershipTransition('removed', 'active')).toBe(false);
    expect(isValidMembershipTransition('active', 'invited')).toBe(false);
    expect(isValidMembershipTransition('removed', 'removed')).toBe(false);
  });

  it('removed is a terminal state', () => {
    expect(isValidMembershipTransition('removed', 'active')).toBe(false);
    expect(isValidMembershipTransition('removed', 'suspended')).toBe(false);
    expect(isValidMembershipTransition('removed', 'invited')).toBe(false);
  });

  it('assertValidMembershipTransition throws on an invalid transition', () => {
    expect(() => assertValidMembershipTransition('removed', 'active')).toThrow(
      InvalidMembershipTransitionError,
    );
  });

  it('assertValidMembershipTransition does not throw on a valid transition', () => {
    expect(() => assertValidMembershipTransition('active', 'suspended')).not.toThrow();
  });
});
