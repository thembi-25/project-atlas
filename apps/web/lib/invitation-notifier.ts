import type { InvitationNotifier } from '@atlas/identity';
import { getServerEnv } from './env';
import { logger } from './logger';

/**
 * Console-logging invitation notifier — Resend (ADR-017) is not wired
 * until the sprint that actually needs transactional email generally, not
 * just for this one flow (see docs/13-roadmap/ROADMAP-DECISION.md). Sprint
 * 1 needs the invite -> accept lifecycle to work end-to-end without
 * inventing a premature email integration; this logs the invitation link
 * at `info` level so a developer/tester can complete the flow manually.
 *
 * The link itself (containing the raw token) is intentionally logged, not
 * the token in isolation — but never logged alongside any other secret,
 * and this entire module is replaced wholesale, not extended, once Resend
 * is introduced.
 */
export const consoleInvitationNotifier: InvitationNotifier = {
  async sendInvitation({ invitedEmail, organizationName, invitationToken, invitedByName }) {
    const acceptUrl = `${getServerEnv().APP_URL}/invitations/${invitationToken}/accept`;
    logger.info('Invitation created (email delivery not yet wired — ADR-017 is a later sprint)', {
      invitedEmail,
      organizationName,
      invitedByName,
      acceptUrl,
    });
  },
};
