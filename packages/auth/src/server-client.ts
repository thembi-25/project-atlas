import { createServerClient } from '@supabase/ssr';
import type { CookieAdapter, SupabaseConnectionConfig } from './types';

/**
 * Server-side Supabase client, session-aware via the supplied cookie
 * adapter. Used inside Route Handlers / Server Components to resolve the
 * current authenticated session. See ADR-006 and
 * docs/05-api/authentication.md.
 *
 * This client is RLS-scoped (uses the anon key + the caller's session
 * JWT) — it must never be constructed with the service-role key. See
 * docs/07-security/authorization-security.md, "Service-role usage is
 * exceptional and logged".
 */
export function createSupabaseServerClient(
  config: SupabaseConnectionConfig,
  cookies: CookieAdapter,
) {
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      get(name: string) {
        return cookies.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        cookies.set(name, value, options);
      },
      remove(name: string, options: Record<string, unknown>) {
        cookies.remove(name, options);
      },
    },
  });
}
