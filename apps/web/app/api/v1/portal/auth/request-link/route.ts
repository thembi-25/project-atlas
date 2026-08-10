import { z } from 'zod';
import { requestPortalMagicLink } from '@atlas/crm';
import { getDb } from '@/lib/db';
import { getPublicEnv, getServerEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { consolePortalMagicLinkNotifier } from '@/lib/portal-magic-link-notifier';

/**
 * POST /api/v1/portal/auth/request-link — Customer Portal login, step 1.
 * Unauthenticated by design (this IS the login entrypoint). Always
 * responds the same way regardless of whether the email matched any
 * portal-access-enabled Contact — see @atlas/crm's `requestPortalMagicLink`
 * for the "don't leak existence" reasoning.
 */
const schema = z.object({ email: z.string().email() });

export const POST = withApiHandler(async (request) => {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new AppError('validation_error', 'A valid email is required.', [
      { field: 'email', issue: 'required' },
    ]);
  }

  await requestPortalMagicLink(
    getDb(),
    { email: parsed.data.email },
    {
      url: getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey: getServerEnv().SUPABASE_SERVICE_ROLE_KEY,
    },
    consolePortalMagicLinkNotifier,
  );

  return {
    data: { message: 'If that email is registered for Portal access, a login link has been sent.' },
  };
});
