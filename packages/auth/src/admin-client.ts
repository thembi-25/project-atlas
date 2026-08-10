import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Auth **admin** client — the service-role key, never the anon
 * key. Per `.env.example`'s own guidance on `SUPABASE_SERVICE_ROLE_KEY`
 * ("narrow, reviewed platform-admin code paths"), this is the first and
 * only such path: the Customer Portal's magic-link issuance (ADR-006 —
 * "a distinct, magic-link-based authentication flow atop the same
 * Supabase Auth primitive") needs `auth.admin.generateLink`, an
 * operation the anon-key `createSupabaseServerClient`/
 * `createSupabaseBrowserClient` cannot perform. Never used for direct
 * data access — see docs/07-security/authorization-security.md,
 * "Service-role usage is exceptional and logged."
 */
export interface SupabaseAdminConnectionConfig {
  url: string;
  serviceRoleKey: string;
}

let cachedClient: SupabaseClient | undefined;

export function getSupabaseAdminClient(config: SupabaseAdminConnectionConfig): SupabaseClient {
  if (cachedClient) return cachedClient;
  cachedClient = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedClient;
}

/** Test-only: clears the cached client so tests can swap config between cases. */
export function resetSupabaseAdminClientForTests(): void {
  cachedClient = undefined;
}
