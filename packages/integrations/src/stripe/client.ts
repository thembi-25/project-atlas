import Stripe from 'stripe';

/**
 * Lazily-constructed Stripe SDK client, per ADR-018. `STRIPE_SECRET_KEY` is
 * an anticipated-but-not-yet-configured environment variable in this
 * sandbox (see .env.example) — every function in this module fails loudly
 * and immediately if it's missing, rather than silently no-op'ing, so a
 * misconfigured deployment surfaces at the first payment attempt, not as a
 * confusing downstream symptom.
 */
let cachedClient: Stripe | undefined;

export function getStripeClient(): Stripe {
  if (cachedClient) return cachedClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      'STRIPE_SECRET_KEY is not configured. Set it in the environment before calling any @atlas/integrations Stripe function.',
    );
  }

  cachedClient = new Stripe(secretKey, {
    apiVersion: '2025-02-24.acacia',
  });
  return cachedClient;
}

/** Test-only: clears the cached client so tests can swap env vars between cases. */
export function resetStripeClientForTests(): void {
  cachedClient = undefined;
}
