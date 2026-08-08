import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Invitation token generation/verification.
 *
 * Neither a dedicated invitations table nor a token mechanism is specified
 * in the docs (documented gap — see SPRINT-1-COMPLETION-REPORT.md); this is
 * this sprint's resolution: a cryptographically random token is generated
 * and only its SHA-256 hash is stored (on `organization_memberships`, per
 * packages/database/src/schema/identity.ts), the same pattern used for
 * password-reset tokens — the raw token exists only in the invitation
 * email/link, never at rest.
 */
const TOKEN_BYTES = 32;
export const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface GeneratedInvitationToken {
  /** The raw token — goes into the invitation link, never stored. */
  token: string;
  /** SHA-256 hex digest — stored in `invitation_token_hash`. */
  tokenHash: string;
  expiresAt: Date;
}

export function generateInvitationToken(now: Date = new Date()): GeneratedInvitationToken {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return {
    token,
    tokenHash: hashInvitationToken(token),
    expiresAt: new Date(now.getTime() + INVITATION_EXPIRY_MS),
  };
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison against a stored hash, to avoid timing side-channels. */
export function verifyInvitationToken(token: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashInvitationToken(token), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (candidate.length !== stored.length) {
    return false;
  }
  return timingSafeEqual(candidate, stored);
}

export function isInvitationExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
