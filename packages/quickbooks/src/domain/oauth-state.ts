import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * The OAuth `state` parameter Intuit round-trips back on the callback —
 * CSRF protection for the connect flow (integrations-prd.md §7). Rather
 * than a server-side session store (none exists in this codebase — Atlas
 * is otherwise stateless between requests, per
 * docs/02-architecture/container-architecture.md), the state itself
 * carries a signed, self-contained payload: which Organization/actor
 * initiated the connect attempt, plus a nonce and issue time, HMAC-signed
 * with `QUICKBOOKS_CLIENT_SECRET` (already a secret only the server
 * knows) so the callback can verify it without any stored session. Mirrors
 * `@atlas/identity`'s `invitation-token.ts` — a signed, stateless token
 * rather than a database-backed session for a short-lived flow.
 */
export interface QuickBooksOAuthState {
  organizationId: string;
  actorUserId: string;
  nonce: string;
  issuedAt: number;
}

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export class InvalidOAuthStateError extends Error {
  constructor(reason: string) {
    super(`Invalid QuickBooks OAuth state: ${reason}`);
    this.name = 'InvalidOAuthStateError';
  }
}

export function generateOAuthState(
  params: { organizationId: string; actorUserId: string },
  secret: string,
): string {
  const payload: QuickBooksOAuthState = {
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    nonce: randomBytes(16).toString('hex'),
    issuedAt: Date.now(),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

export function verifyOAuthState(state: string, secret: string): QuickBooksOAuthState {
  const [payloadB64, signature] = state.split('.');
  if (!payloadB64 || !signature) {
    throw new InvalidOAuthStateError('malformed');
  }

  const expectedSignature = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(signature);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new InvalidOAuthStateError('signature mismatch');
  }

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as QuickBooksOAuthState;
  if (Date.now() - payload.issuedAt > STATE_MAX_AGE_MS) {
    throw new InvalidOAuthStateError('expired');
  }
  return payload;
}
