import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { upsertUserFromAuth } from '@atlas/identity';
import { generatePortalMagicLink, type SupabaseAdminConnectionConfig } from '@atlas/auth';
import {
  findPortalContactsByEmail,
  linkContactPortalUser,
  listContactsByPortalUserId,
  type Contact,
} from '../infrastructure/contacts';

/**
 * Decoupled from any concrete email provider, same reasoning as
 * @atlas/identity's `InvitationNotifier` — Resend (ADR-017) isn't wired
 * yet. apps/web supplies a console-logging implementation for now.
 */
export interface PortalMagicLinkNotifier {
  sendMagicLink(params: { email: string; tokenHash: string }): Promise<void>;
}

export interface RequestPortalMagicLinkParams {
  email: string;
}

/**
 * Customer Portal login, step 1 — docs/06-modules/customer-portal-prd.md,
 * docs/13-roadmap/sprint-5.md. Deliberately does NOT reveal whether the
 * email matched any Contact (always resolves the same way) — the same
 * "don't leak existence" posture as every other unauthenticated lookup in
 * this codebase. If at least one portal-access-enabled Contact matches,
 * a real Supabase Auth magic-link OTP is generated and handed to the
 * notifier as its `token_hash` — the notifier (apps/web) builds Atlas's
 * own verification URL from it (e.g. `/portal/login/verify?token_hash=
 * ...`), consumed client-side via Supabase's `auth.verifyOtp({ token_hash,
 * type: 'magiclink' })` — rather than Supabase's own hosted `action_link`,
 * which assumes Supabase's email templates/redirect config are set up,
 * unnecessary here since Atlas sends its own notification. Unmatched
 * emails silently do nothing.
 */
export async function requestPortalMagicLink(
  db: DatabaseClient,
  params: RequestPortalMagicLinkParams,
  config: SupabaseAdminConnectionConfig,
  notifier: PortalMagicLinkNotifier,
): Promise<void> {
  const contacts = await withServiceContext(db, (tx) =>
    findPortalContactsByEmail(tx, params.email),
  );
  if (contacts.length === 0) {
    return;
  }

  const link = await generatePortalMagicLink(config, params.email);
  await notifier.sendMagicLink({ email: params.email, tokenHash: link.hashedToken });
}

export interface CompletePortalLoginParams {
  /** The Supabase Auth user id from the now-verified session (`auth.uid()` after the client's `verifyOtp` call) — see docs/13-roadmap/sprint-5.md. */
  portalUserId: string;
  email: string;
  fullName: string;
}

export interface CompletePortalLoginResult {
  contacts: Contact[];
}

/**
 * Customer Portal login, step 2 — called once the frontend has already
 * verified the OTP via Supabase's own client SDK, establishing a real
 * `auth.uid() = portalUserId` session. Ensures the `identity.users` row
 * exists (same primitive a staff User uses — see @atlas/identity's
 * `upsertUserFromAuth`) and links every portal-access-enabled Contact
 * matching this email to it. Runs under `withServiceContext`: before
 * this link exists, RLS's `contacts.portal_user_id = auth.uid()` policy
 * grants this session no visibility into the very rows it needs to link
 * — the same "no standing grant yet" reasoning as `acceptInvitation`.
 */
export async function completePortalLogin(
  db: DatabaseClient,
  params: CompletePortalLoginParams,
): Promise<CompletePortalLoginResult> {
  return withServiceContext(
    db,
    async (tx) => {
      await upsertUserFromAuth(tx, {
        id: params.portalUserId,
        email: params.email,
        fullName: params.fullName,
      });

      const matches = await findPortalContactsByEmail(tx, params.email);
      const linked: Contact[] = [];
      for (const contact of matches) {
        if (contact.portalUserId === params.portalUserId) {
          linked.push(contact);
          continue;
        }
        const updated = await linkContactPortalUser(tx, contact.id, params.portalUserId);
        if (updated) linked.push(updated);
      }

      return { contacts: linked };
    },
    params.portalUserId,
  );
}

export interface GetPortalContactsParams {
  portalUserId: string;
}

/** Resolves "which Customers can this Portal session see" for session bootstrap (e.g. a Customer picker if a Contact belongs to more than one Organization). */
export async function getPortalContacts(
  db: DatabaseClient,
  params: GetPortalContactsParams,
): Promise<Contact[]> {
  return withServiceContext(db, (tx) => listContactsByPortalUserId(tx, params.portalUserId));
}
