'use client';

import { createSupabaseBrowserClient } from '@atlas/auth';

/**
 * Browser-side Supabase client for the Customer Portal's magic-link
 * verification (`auth.verifyOtp`) — the first client-side Supabase Auth
 * call in this codebase (staff auth so far only ever resolves an
 * already-established session server-side via `getAuthenticatedUser()`).
 * `NEXT_PUBLIC_`-prefixed vars are inlined by Next.js at build time, safe
 * to read directly in a Client Component — see docs/07-security/
 * secrets-management.md.
 */
export function getSupabaseBrowserClient() {
  return createSupabaseBrowserClient({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  });
}
