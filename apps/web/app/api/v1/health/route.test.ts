import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCacheForTests } from '@/lib/env';
import { GET } from './route';

const validServerEnv = {
  NODE_ENV: 'test',
  APP_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:54322/postgres',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  LOG_LEVEL: 'error',
};

describe('GET /api/v1/health', () => {
  afterEach(() => {
    resetEnvCacheForTests();
    vi.unstubAllEnvs();
  });

  it('returns 200 and status ok when the environment is valid', async () => {
    for (const [key, value] of Object.entries(validServerEnv)) {
      vi.stubEnv(key, value);
    }

    const response = await GET(new Request('http://localhost/api/v1/health'));
    const body = (await response.json()) as { status: string; checks: { environment: string } };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.checks.environment).toBe('ok');
  });

  it('echoes an inbound X-Request-Id rather than minting a new one', async () => {
    for (const [key, value] of Object.entries(validServerEnv)) {
      vi.stubEnv(key, value);
    }

    const response = await GET(
      new Request('http://localhost/api/v1/health', {
        headers: { 'x-request-id': 'test-request-id-123' },
      }),
    );
    const body = (await response.json()) as { requestId: string };

    expect(body.requestId).toBe('test-request-id-123');
    expect(response.headers.get('x-request-id')).toBe('test-request-id-123');
  });

  it('returns 503 and status degraded when required environment variables are missing', async () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    const response = await GET(new Request('http://localhost/api/v1/health'));
    const body = (await response.json()) as { status: string; checks: { environment: string } };

    expect(response.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks.environment).toBe('failed');
  });

  it('never includes a secret value in the response body', async () => {
    for (const [key, value] of Object.entries(validServerEnv)) {
      vi.stubEnv(key, value);
    }

    const response = await GET(new Request('http://localhost/api/v1/health'));
    const text = await response.text();

    expect(text).not.toContain(validServerEnv.SUPABASE_SERVICE_ROLE_KEY);
    expect(text).not.toContain(validServerEnv.DATABASE_URL);
  });
});
