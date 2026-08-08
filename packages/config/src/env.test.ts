import { describe, expect, it } from 'vitest';
import { EnvValidationError, validatePublicEnv, validateServerEnv } from './env';

const validServerEnv = {
  NODE_ENV: 'test',
  APP_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:54322/postgres',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  LOG_LEVEL: 'info',
};

const validPublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
};

describe('validateServerEnv', () => {
  it('accepts a fully valid server environment', () => {
    const env = validateServerEnv(validServerEnv);
    expect(env.DATABASE_URL).toBe(validServerEnv.DATABASE_URL);
    expect(env.NODE_ENV).toBe('test');
  });

  it('applies documented defaults when optional values are omitted', () => {
    const { LOG_LEVEL, APP_URL, ...rest } = validServerEnv;
    const env = validateServerEnv(rest);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.APP_URL).toBe('http://localhost:3000');
  });

  it('throws EnvValidationError when a required variable is missing', () => {
    const { DATABASE_URL, ...rest } = validServerEnv;
    expect(() => validateServerEnv(rest)).toThrow(EnvValidationError);
  });

  it('never includes secret values in the thrown error message', () => {
    const invalid = { ...validServerEnv, DATABASE_URL: '' };
    try {
      validateServerEnv(invalid);
      expect.unreachable('validateServerEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const message = (error as EnvValidationError).message;
      expect(message).not.toContain(validServerEnv.SUPABASE_SERVICE_ROLE_KEY);
      expect(message).toContain('DATABASE_URL');
    }
  });

  it('rejects an invalid NODE_ENV value', () => {
    expect(() => validateServerEnv({ ...validServerEnv, NODE_ENV: 'staging' })).toThrow(
      EnvValidationError,
    );
  });
});

describe('validatePublicEnv', () => {
  it('accepts a fully valid public environment', () => {
    const env = validatePublicEnv(validPublicEnv);
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(validPublicEnv.NEXT_PUBLIC_SUPABASE_URL);
  });

  it('throws when NEXT_PUBLIC_SUPABASE_URL is not a valid URL', () => {
    expect(() =>
      validatePublicEnv({ ...validPublicEnv, NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' }),
    ).toThrow(EnvValidationError);
  });

  it('throws when a required public variable is missing', () => {
    const { NEXT_PUBLIC_SUPABASE_ANON_KEY, ...rest } = validPublicEnv;
    expect(() => validatePublicEnv(rest)).toThrow(EnvValidationError);
  });
});
