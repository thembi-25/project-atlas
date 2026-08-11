import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildQuickBooksAuthorizationUrl,
  exchangeQuickBooksAuthorizationCode,
  getQuickBooksOAuthConfig,
  QuickBooksOAuthError,
} from './client';

describe('getQuickBooksOAuthConfig', () => {
  const originalClientId = process.env.QUICKBOOKS_CLIENT_ID;
  const originalClientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const originalRedirectUri = process.env.QUICKBOOKS_REDIRECT_URI;

  afterEach(() => {
    process.env.QUICKBOOKS_CLIENT_ID = originalClientId;
    process.env.QUICKBOOKS_CLIENT_SECRET = originalClientSecret;
    process.env.QUICKBOOKS_REDIRECT_URI = originalRedirectUri;
  });

  it('throws a clear error when required env vars are not configured', () => {
    delete process.env.QUICKBOOKS_CLIENT_ID;
    delete process.env.QUICKBOOKS_CLIENT_SECRET;
    delete process.env.QUICKBOOKS_REDIRECT_URI;
    expect(() => getQuickBooksOAuthConfig()).toThrow('QUICKBOOKS_CLIENT_ID');
  });
});

describe('buildQuickBooksAuthorizationUrl', () => {
  beforeEach(() => {
    process.env.QUICKBOOKS_CLIENT_ID = 'fake_client_id';
    process.env.QUICKBOOKS_CLIENT_SECRET = 'fake_client_secret';
    process.env.QUICKBOOKS_REDIRECT_URI = 'https://atlas.example.com/api/v1/integrations/quickbooks/callback';
  });

  it('includes the CSRF state token and accounting scope', () => {
    const url = new URL(buildQuickBooksAuthorizationUrl('csrf-token-123'));
    expect(url.origin + url.pathname).toBe('https://appcenter.intuit.com/connect/oauth2');
    expect(url.searchParams.get('state')).toBe('csrf-token-123');
    expect(url.searchParams.get('scope')).toBe('com.intuit.quickbooks.accounting');
    expect(url.searchParams.get('client_id')).toBe('fake_client_id');
  });
});

describe('exchangeQuickBooksAuthorizationCode', () => {
  beforeEach(() => {
    process.env.QUICKBOOKS_CLIENT_ID = 'fake_client_id';
    process.env.QUICKBOOKS_CLIENT_SECRET = 'fake_client_secret';
    process.env.QUICKBOOKS_REDIRECT_URI = 'https://atlas.example.com/api/v1/integrations/quickbooks/callback';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a successful token response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'at_fake', refresh_token: 'rt_fake', expires_in: 3600 }),
      }),
    );

    const result = await exchangeQuickBooksAuthorizationCode('auth-code');
    expect(result).toEqual({ accessToken: 'at_fake', refreshToken: 'rt_fake', expiresInSeconds: 3600 });
  });

  it('wraps a non-ok response in QuickBooksOAuthError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve('invalid_grant') }),
    );

    await expect(exchangeQuickBooksAuthorizationCode('bad-code')).rejects.toThrow(QuickBooksOAuthError);
  });
});
