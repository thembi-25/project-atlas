/**
 * Minimal cookie adapter interface, deliberately decoupled from Next.js's
 * concrete cookie APIs so this package doesn't force a hard dependency on
 * `next/headers` — apps/web supplies the adapter. See
 * docs/05-api/authentication.md, "Session handling".
 */
export interface CookieAdapter {
  get(name: string): { name: string; value: string } | undefined;
  set(name: string, value: string, options?: Record<string, unknown>): void;
  remove(name: string, options?: Record<string, unknown>): void;
}

export interface SupabaseConnectionConfig {
  url: string;
  anonKey: string;
}
