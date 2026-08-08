import { cookies } from 'next/headers';
import { createSupabaseServerClient, type CookieAdapter } from '@atlas/auth';
import { getPublicEnv } from './env';
import { AppError } from './errors';

/**
 * Resolves the authenticated Supabase Auth user for a route handler, per
 * docs/05-api/authentication.md ("Authorization: Bearer <jwt>" via cookie
 * session for the first-party app) — see ADR-006.
 *
 * Uses `supabase.auth.getUser()`, not `getSession()`: `getUser()`
 * revalidates the JWT against Supabase Auth on every call rather than
 * trusting a possibly-stale cookie, which matters for the same reason
 * docs/04-database/multi-tenancy.md gives for membership-based RLS over
 * JWT claims — see docs/07-security/authentication-security.md.
 */
export async function getAuthenticatedUser(): Promise<{
  id: string;
  email: string;
  fullName: string;
}> {
  const cookieStore = cookies();
  type CookieSetOptions = NonNullable<Parameters<typeof cookieStore.set>[2]>;
  const cookieAdapter: CookieAdapter = {
    get: (name) => {
      const cookie = cookieStore.get(name);
      return cookie ? { name: cookie.name, value: cookie.value } : undefined;
    },
    set: (name, value, options) => {
      cookieStore.set(name, value, options as unknown as CookieSetOptions);
    },
    remove: (name, options) => {
      cookieStore.set(name, '', { ...(options as unknown as CookieSetOptions), maxAge: 0 });
    },
  };

  const supabase = createSupabaseServerClient(
    {
      url: getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
      anonKey: getPublicEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    cookieAdapter,
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    throw new AppError('unauthenticated', 'A valid session is required to access this resource.');
  }

  const fullName = (user.user_metadata as Record<string, unknown> | null)?.['full_name'];

  return {
    id: user.id,
    email: user.email,
    fullName: typeof fullName === 'string' && fullName.length > 0 ? fullName : user.email,
  };
}
