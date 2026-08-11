/**
 * QuickBooks Online OAuth2 client — ADR-019, integrations-prd.md.
 * `QUICKBOOKS_CLIENT_ID`/`QUICKBOOKS_CLIENT_SECRET`/`QUICKBOOKS_REDIRECT_URI`
 * are anticipated-but-not-yet-configured environment variables in this
 * sandbox (see .env.example) — mirrors `stripe/client.ts`'s "fail loudly
 * if missing" discipline. No official Intuit Node SDK dependency is added;
 * Intuit's OAuth2 flow is a small number of plain HTTP calls against
 * well-documented endpoints, consistent with ADR-019's "clean, typed
 * client — not a forced common interface" stance and avoiding a dependency
 * for a handful of `fetch` calls this sandbox cannot exercise live anyway
 * (no registered Intuit app to test against).
 */
const AUTHORIZATION_URL = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
const ACCOUNTING_SCOPE = 'com.intuit.quickbooks.accounting';

export interface QuickBooksOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function getQuickBooksOAuthConfig(): QuickBooksOAuthConfig {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'QUICKBOOKS_CLIENT_ID/QUICKBOOKS_CLIENT_SECRET/QUICKBOOKS_REDIRECT_URI are not configured. Set them in the environment before calling any @atlas/integrations QuickBooks function.',
    );
  }
  return { clientId, clientSecret, redirectUri };
}

/** Builds the Intuit-hosted authorization redirect URL. `state` must be an unguessable, per-attempt CSRF token the caller generates and verifies on callback. */
export function buildQuickBooksAuthorizationUrl(state: string): string {
  const config = getQuickBooksOAuthConfig();
  const url = new URL(AUTHORIZATION_URL);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', ACCOUNTING_SCOPE);
  url.searchParams.set('state', state);
  return url.toString();
}

export interface QuickBooksTokenResult {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export class QuickBooksOAuthError extends Error {
  constructor(step: string, cause: unknown) {
    super(`QuickBooks OAuth ${step} failed: ${String(cause)}`);
    this.name = 'QuickBooksOAuthError';
  }
}

function basicAuthHeader(config: QuickBooksOAuthConfig): string {
  return `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`;
}

async function requestToken(body: URLSearchParams, step: string): Promise<QuickBooksTokenResult> {
  const config = getQuickBooksOAuthConfig();
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(config),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });

  if (!response.ok) {
    throw new QuickBooksOAuthError(step, await response.text());
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresInSeconds: data.expires_in,
  };
}

/** Exchanges an authorization-code callback for the initial access/refresh token pair. `realmId` is the QuickBooks company ID Intuit returns alongside `code` on the callback query string. */
export async function exchangeQuickBooksAuthorizationCode(code: string): Promise<QuickBooksTokenResult> {
  const config = getQuickBooksOAuthConfig();
  return requestToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    }),
    'authorization-code exchange',
  );
}

export async function refreshQuickBooksAccessToken(refreshToken: string): Promise<QuickBooksTokenResult> {
  return requestToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    'token refresh',
  );
}

/** Revokes a refresh (or access) token — called on disconnect so the connection can't be silently reused. */
export async function revokeQuickBooksToken(token: string): Promise<void> {
  const config = getQuickBooksOAuthConfig();
  const response = await fetch(REVOKE_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(config),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ token }),
  });

  if (!response.ok) {
    throw new QuickBooksOAuthError('token revocation', await response.text());
  }
}
