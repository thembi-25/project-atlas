import { NextResponse } from 'next/server';
import { completeQuickBooksConnect } from '@atlas/quickbooks';
import { getDb } from '@/lib/db';
import { getServerEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * GET /api/v1/integrations/quickbooks/callback — the Intuit-hosted OAuth
 * consent screen redirects the browser here with `code`/`state`/`realmId`
 * query parameters (integrations-prd.md §7). Unlike every other route in
 * this app, the client here is a browser navigation, not an API
 * consumer — so this returns an HTTP redirect to the Settings →
 * Integrations page (`APP_URL`-relative), not a JSON envelope, mirroring
 * how `withApiHandler` is deliberately not used for
 * `apps/web/app/api/v1/exports/route.ts` either.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const redirectBase = new URL('/settings/integrations', getServerEnv().APP_URL);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const realmId = url.searchParams.get('realmId');

  if (!code || !state || !realmId) {
    redirectBase.searchParams.set('quickbooks_error', 'missing_callback_parameters');
    return NextResponse.redirect(redirectBase);
  }

  try {
    await completeQuickBooksConnect(getDb(), { code, state, realmId });
    redirectBase.searchParams.set('quickbooks', 'connected');
    return NextResponse.redirect(redirectBase);
  } catch (error) {
    logger.error('QuickBooks OAuth callback failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    redirectBase.searchParams.set('quickbooks_error', 'connect_failed');
    return NextResponse.redirect(redirectBase);
  }
}
