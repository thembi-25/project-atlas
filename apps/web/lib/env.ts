import {
  validatePublicEnv,
  validateServerEnv,
  type PublicEnv,
  type ServerEnv,
} from '@atlas/config';

/**
 * Validated environment access for the web app. Validation runs once
 * (memoized) and throws a clear, secret-safe error if misconfigured — see
 * docs/07-security/secrets-management.md and
 * docs/10-devops/local-development.md.
 *
 * `getServerEnv` must never be called from client code — Next.js will
 * still bundle the *values* if you do, since there's no build-time
 * enforcement here beyond convention; see docs/05-api/authentication.md
 * and the NEXT_PUBLIC_ prefix convention in .env.example for the actual
 * enforced boundary (only NEXT_PUBLIC_-prefixed variables are inlined into
 * client bundles by Next.js itself).
 */

let cachedServerEnv: ServerEnv | undefined;
let cachedPublicEnv: PublicEnv | undefined;

export function getServerEnv(): ServerEnv {
  cachedServerEnv ??= validateServerEnv(process.env);
  return cachedServerEnv;
}

export function getPublicEnv(): PublicEnv {
  cachedPublicEnv ??= validatePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });
  return cachedPublicEnv;
}

/** Test-only: clears the memoized env so tests can validate fresh input. */
export function resetEnvCacheForTests(): void {
  cachedServerEnv = undefined;
  cachedPublicEnv = undefined;
}
