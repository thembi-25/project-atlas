import { getSupabaseAdminClient, type SupabaseAdminConnectionConfig } from './admin-client';

export interface PortalMagicLink {
  actionLink: string;
  hashedToken: string;
}

/**
 * Issues a Supabase-Auth-native, single-use, short-expiry magic-link OTP
 * for a Portal login — reuses Supabase Auth's own OTP generation/
 * verification (`auth.admin.generateLink` + the client SDK's
 * `verifyOtp({ token_hash, type: 'magiclink' })`) rather than a
 * hand-rolled token table, since Supabase Auth is already the system of
 * record for authentication (ADR-006). `generateLink` also creates the
 * underlying `auth.users` row if this email has never signed in before —
 * no separate signup step is needed for a Contact.
 */
export async function generatePortalMagicLink(
  config: SupabaseAdminConnectionConfig,
  email: string,
): Promise<PortalMagicLink> {
  const admin = getSupabaseAdminClient(config);
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data.properties) {
    throw new Error(`Failed to generate Portal magic link: ${error?.message ?? 'unknown error'}`);
  }
  return {
    actionLink: data.properties.action_link,
    hashedToken: data.properties.hashed_token,
  };
}
