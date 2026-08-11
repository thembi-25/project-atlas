import { describe, expect, it, vi } from 'vitest';
import { generateOAuthState, InvalidOAuthStateError, verifyOAuthState } from './oauth-state';

describe('generateOAuthState / verifyOAuthState', () => {
  const secret = 'fake_quickbooks_client_secret_for_unit_tests';

  it('round-trips organizationId/actorUserId through a valid state token', () => {
    const state = generateOAuthState({ organizationId: 'org-1', actorUserId: 'user-1' }, secret);
    const payload = verifyOAuthState(state, secret);
    expect(payload.organizationId).toBe('org-1');
    expect(payload.actorUserId).toBe('user-1');
  });

  it('rejects a state signed with a different secret', () => {
    const state = generateOAuthState({ organizationId: 'org-1', actorUserId: 'user-1' }, secret);
    expect(() => verifyOAuthState(state, 'a-different-secret')).toThrow(InvalidOAuthStateError);
  });

  it('rejects a malformed state', () => {
    expect(() => verifyOAuthState('not-a-real-state-token', secret)).toThrow(InvalidOAuthStateError);
  });

  it('rejects an expired state', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T12:00:00Z'));
    const state = generateOAuthState({ organizationId: 'org-1', actorUserId: 'user-1' }, secret);
    vi.setSystemTime(new Date('2026-08-11T12:11:00Z'));
    expect(() => verifyOAuthState(state, secret)).toThrow(InvalidOAuthStateError);
    vi.useRealTimers();
  });
});
