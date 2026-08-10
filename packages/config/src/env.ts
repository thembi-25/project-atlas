import { z } from 'zod';

/**
 * Typed environment validation, shared by apps/web and apps/worker.
 *
 * Server and public (browser-exposed) variables are validated separately so
 * a server-only secret can never accidentally end up in the public schema —
 * see docs/07-security/secrets-management.md and
 * docs/10-devops/local-development.md.
 */

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  WORKER_DATABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;

export class EnvValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Environment validation failed:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
}

/**
 * Validates a raw environment record against the server schema.
 * Never includes actual variable values in thrown errors — only names and
 * validation messages — so a validation failure is safe to log.
 */
export function validateServerEnv(
  raw: NodeJS.ProcessEnv | Record<string, string | undefined>,
): ServerEnv {
  const result = serverEnvSchema.safeParse(raw);
  if (!result.success) {
    throw new EnvValidationError(formatZodIssues(result.error));
  }
  return result.data;
}

export function validatePublicEnv(
  raw: NodeJS.ProcessEnv | Record<string, string | undefined>,
): PublicEnv {
  const result = publicEnvSchema.safeParse(raw);
  if (!result.success) {
    throw new EnvValidationError(formatZodIssues(result.error));
  }
  return result.data;
}
