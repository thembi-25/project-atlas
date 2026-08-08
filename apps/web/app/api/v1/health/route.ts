import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { REQUEST_ID_HEADER, resolveRequestId } from '@/lib/request-id';

/**
 * GET /api/v1/health
 *
 * Reports application health without exposing secrets — see
 * docs/05-api/api-overview.md and docs/12-claude/api-instructions.md
 * ("A health endpoint is acceptable" for Sprint 0's API foundation).
 *
 * Deliberately does NOT attempt a live database round-trip here: a health
 * check that depends on a downstream dependency can turn a Postgres blip
 * into a full outage signal for the app itself. Database connectivity is
 * verified independently via `pnpm db:check` — see
 * docs/13-roadmap/SPRINT-0-COMPLETION-REPORT.md for why, and
 * docs/10-devops/monitoring.md for the broader monitoring picture this
 * endpoint feeds into (synthetic checks, uptime).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const requestId = resolveRequestId(request.headers);
  const log = logger.child({ requestId });

  let envOk = true;
  try {
    getServerEnv();
  } catch (error) {
    envOk = false;
    log.error('Health check: server environment validation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const body = {
    status: envOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    requestId,
    checks: {
      environment: envOk ? 'ok' : 'failed',
    },
  } as const;

  log.info('Health check served', { status: body.status });

  return NextResponse.json(body, {
    status: envOk ? 200 : 503,
    headers: { [REQUEST_ID_HEADER]: requestId },
  });
}
