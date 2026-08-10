import { NextResponse } from 'next/server';
import { AppError, toApiErrorBody, toAppError } from './errors';
import { mapIdentityError } from './identity-errors';
import { mapCrmError } from './crm-errors';
import { mapPropertiesError } from './properties-errors';
import { mapAssetsError } from './assets-errors';
import { mapJobsError } from './jobs-errors';
import { mapSchedulingError } from './scheduling-errors';
import { mapFinancialsError } from './financials-errors';
import { getServerEnv } from './env';
import { logger } from './logger';
import { REQUEST_ID_HEADER, resolveRequestId } from './request-id';

/**
 * Wraps a route handler body with the standard response envelope
 * (`{ data }`, or `{ data, meta }` for paginated collections, on success),
 * error mapping, request-id propagation, and structured logging — see
 * docs/05-api/resource-conventions.md, docs/05-api/pagination.md,
 * docs/05-api/errors.md.
 */
export function withApiHandler<T, C = undefined>(
  handler: (
    request: Request,
    context: C,
  ) => Promise<{ data: T; status?: number; meta?: Record<string, unknown> }>,
) {
  return async (request: Request, context: C): Promise<NextResponse> => {
    const requestId = resolveRequestId(request.headers);
    const log = logger.child({ requestId });

    try {
      const { data, status, meta } = await handler(request, context);
      return NextResponse.json(meta !== undefined ? { data, meta } : { data }, {
        status: status ?? 200,
        headers: { [REQUEST_ID_HEADER]: requestId },
      });
    } catch (rawError) {
      const error: AppError =
        mapIdentityError(rawError) ??
        mapCrmError(rawError) ??
        mapPropertiesError(rawError) ??
        mapAssetsError(rawError) ??
        mapJobsError(rawError) ??
        mapSchedulingError(rawError) ??
        mapFinancialsError(rawError) ??
        toAppError(rawError);

      if (error.code === 'internal_error') {
        log.error('Unhandled route error', {
          error: error.message,
          stack: rawError instanceof Error ? rawError.stack : undefined,
        });
      }

      const isProduction = getServerEnv().NODE_ENV === 'production';
      return NextResponse.json(toApiErrorBody(error, isProduction), {
        status: error.status,
        headers: { [REQUEST_ID_HEADER]: requestId },
      });
    }
  };
}
