import type { PortalMagicLinkNotifier } from '@atlas/crm';
import { getServerEnv } from './env';
import { logger } from './logger';

/**
 * Console-logging Portal magic-link notifier — same reasoning as
 * `invitation-notifier.ts`: Resend (ADR-017) isn't wired until a later
 * sprint. Builds Atlas's own verification URL from the Supabase-issued
 * `token_hash` (consumed client-side by `/portal/login`'s
 * `auth.verifyOtp` call) and logs it at `info` level so a developer/
 * tester can complete the Portal login flow manually. Replaced wholesale,
 * not extended, once Resend is introduced.
 */
export const consolePortalMagicLinkNotifier: PortalMagicLinkNotifier = {
  async sendMagicLink({ email, tokenHash }) {
    const verifyUrl = `${getServerEnv().APP_URL}/portal/login?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`;
    logger.info(
      'Portal magic link issued (email delivery not yet wired — ADR-017 is a later sprint)',
      {
        email,
        verifyUrl,
      },
    );
  },
};
