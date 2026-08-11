import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { buildQuickBooksAuthorizationUrl, exchangeQuickBooksAuthorizationCode } from '@atlas/integrations';
import { generateOAuthState, verifyOAuthState } from '../domain/oauth-state';
import { upsertConnected, type IntegrationConnection } from '../infrastructure/connections';
import { requireIntegrationsAdminAccess } from './authorize';

function requireStateSecret(): string {
  const secret = process.env.QUICKBOOKS_CLIENT_SECRET;
  if (!secret) {
    throw new Error('QUICKBOOKS_CLIENT_SECRET is not configured.');
  }
  return secret;
}

export interface BeginQuickBooksConnectParams {
  organizationId: string;
  actorUserId: string;
}

/** integrations-prd.md §11 `POST /api/v1/integrations/quickbooks/connect` — returns the Intuit-hosted authorization URL to redirect the browser to. */
export async function beginQuickBooksConnect(
  db: DatabaseClient,
  params: BeginQuickBooksConnectParams,
): Promise<{ authorizationUrl: string }> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireIntegrationsAdminAccess(tx, params);
    const state = generateOAuthState(params, requireStateSecret());
    return { authorizationUrl: buildQuickBooksAuthorizationUrl(state) };
  });
}

export interface CompleteQuickBooksConnectParams {
  code: string;
  state: string;
  realmId: string;
}

/**
 * The OAuth callback handler — verifies `state` (re-establishing which
 * Organization/actor initiated the connect, since the callback itself
 * carries no session), exchanges `code` for tokens, and upserts the
 * `integration_connections` row. Runs the admin-access check again here
 * (not just at `beginQuickBooksConnect`) in case the actor's Membership
 * changed in the window between redirect and callback.
 */
export async function completeQuickBooksConnect(
  db: DatabaseClient,
  params: CompleteQuickBooksConnectParams,
): Promise<IntegrationConnection> {
  const statePayload = verifyOAuthState(params.state, requireStateSecret());
  const tokens = await exchangeQuickBooksAuthorizationCode(params.code);

  return withRequestContext(db, statePayload.actorUserId, async (tx) => {
    await requireIntegrationsAdminAccess(tx, {
      organizationId: statePayload.organizationId,
      actorUserId: statePayload.actorUserId,
    });
    return upsertConnected(tx, {
      organizationId: statePayload.organizationId,
      provider: 'quickbooks',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      realmId: params.realmId,
      connectedByUserId: statePayload.actorUserId,
    });
  });
}
