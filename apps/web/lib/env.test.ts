import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPublicEnv, getServerEnv, resetEnvCacheForTests } from './env';

const validServerEnv = {
  NODE_ENV: 'test',
  APP_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:54322/postgres',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  LOG_LEVEL: 'error',
};

const validPublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
};

describe('getServerEnv', () => {
  afterEach(() => {
    resetEnvCacheForTests();
    vi.unstubAllEnvs();
  });

  it('validates and returns process.env when it is well-formed', () => {
    for (const [key, value] of Object.entries(validServerEnv)) {
      vi.stubEnv(key, value);
    }
    const env = getServerEnv();
    expect(env.DATABASE_URL).toBe(validServerEnv.DATABASE_URL);
  });

  it('memoizes the result across calls', () => {
    for (const [key, value] of Object.entries(validServerEnv)) {
      vi.stubEnv(key, value);
    }
    const first = getServerEnv();
    const second = getServerEnv();
    expect(first).toBe(second);
  });

  it('throws when required variables are missing', () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(() => getServerEnv()).toThrow();
  });
});

describe('getPublicEnv', () => {
  afterEach(() => {
    resetEnvCacheForTests();
    vi.unstubAllEnvs();
  });

  it('validates and returns the NEXT_PUBLIC_ variables', () => {
    for (const [key, value] of Object.entries(validPublicEnv)) {
      vi.stubEnv(key, value);
    }
    const env = getPublicEnv();
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(validPublicEnv.NEXT_PUBLIC_SUPABASE_URL);
  });
});
