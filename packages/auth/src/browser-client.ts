import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseConnectionConfig } from './types';

/**
 * Browser-side Supabase client. Constructed only with the public URL and
 * anon key (both safe for client exposure — RLS enforces isolation, see
 * docs/04-database/multi-tenancy.md) — never the service-role key.
 */
export function createSupabaseBrowserClient(config: SupabaseConnectionConfig) {
  return createBrowserClient(config.url, config.anonKey);
}
