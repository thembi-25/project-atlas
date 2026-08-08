import { describe, expect, it } from 'vitest';
import {
  generateInvitationToken,
  hashInvitationToken,
  isInvitationExpired,
  verifyInvitationToken,
} from './invitation-token';

describe('invitation tokens', () => {
  it('generates a token whose hash matches the stored hash', () => {
    const generated = generateInvitationToken();
    expect(generated.tokenHash).toBe(hashInvitationToken(generated.token));
  });

  it('verifies a correct token and rejects an incorrect one', () => {
    const generated = generateInvitationToken();
    expect(verifyInvitationToken(generated.token, generated.tokenHash)).toBe(true);
    expect(verifyInvitationToken('not-the-right-token', generated.tokenHash)).toBe(false);
  });

  it('expires 7 days from generation', () => {
    const now = new Date('2026-08-08T00:00:00Z');
    const generated = generateInvitationToken(now);
    expect(generated.expiresAt.toISOString()).toBe('2026-08-15T00:00:00.000Z');
  });

  it('reports expiry correctly relative to a given "now"', () => {
    const expiresAt = new Date('2026-08-15T00:00:00Z');
    expect(isInvitationExpired(expiresAt, new Date('2026-08-14T23:59:59Z'))).toBe(false);
    expect(isInvitationExpired(expiresAt, new Date('2026-08-15T00:00:01Z'))).toBe(true);
  });

  it('never generates the same token twice', () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a.token).not.toBe(b.token);
  });
});
