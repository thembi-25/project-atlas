import { cookies } from 'next/headers';
import { createSupabaseServerClient, type CookieAdapter } from '@atlas/auth';
import { getPublicEnv } from './env';
import { AppError } from './errors';

/**
 * ADR-006 / Identity PRD §7: "Enforce MFA (TOTP) for Owner/Admin Roles."
 * Docs specify enrollment is required, with "a short grace period" before
 * write actions are blocked — no exact duration is given anywhere in the
 * docs (a genuine gap, see SPRINT-1-COMPLETION-REPORT.md), so this sprint
 * enforces immediately rather than inventing an unstated number. Callers
 * are the Owner/Admin-gated mutation routes (invite, membership PATCH,
 * team creation) — a caller without Owner/Admin Role is already rejected
 * by the identity package's own authorization check regardless of MFA
 * status, so this only ever meaningfully blocks an Owner/Admin.
 */
export async function assertMfaEnrolledForPrivilegedAction(): Promise<void> {
  const cookieStore = cookies();
  const cookieAdapter: CookieAdapter = {
    get: (name) => {
      const cookie = cookieStore.get(name);
      return cookie ? { name: cookie.name, value: cookie.value } : undefined;
    },
    set: () => {
      /* no-op: this call only reads MFA factor state, never refreshes the session */
    },
    remove: () => {
      /* no-op */
    },
  };

  const supabase = createSupabaseServerClient(
    {
      url: getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
      anonKey: getPublicEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    cookieAdapter,
  );

  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    throw new AppError('internal_error', 'Could not verify MFA enrollment status.');
  }

  const hasVerifiedTotpFactor = data.totp.some((factor) => factor.status === 'verified');
  if (!hasVerifiedTotpFactor) {
    throw new AppError(
      'forbidden',
      'Multi-factor authentication is required for this action. Enroll a TOTP factor to continue.',
    );
  }
}
