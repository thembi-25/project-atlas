import { Resend } from 'resend';

/**
 * Lazily-constructed Resend SDK client, per ADR-017/ADR-019.
 * `RESEND_API_KEY` is an anticipated-but-not-yet-configured environment
 * variable in this sandbox (see .env.example) — every function in this
 * module fails loudly and immediately if it's missing, mirroring
 * `packages/integrations/src/stripe/client.ts`.
 */
let cachedClient: Resend | undefined;

export function getResendClient(): Resend {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY is not configured. Set it in the environment before calling any @atlas/integrations Resend function.',
    );
  }

  cachedClient = new Resend(apiKey);
  return cachedClient;
}

/** Test-only: clears the cached client so tests can swap env vars between cases. */
export function resetResendClientForTests(): void {
  cachedClient = undefined;
}
