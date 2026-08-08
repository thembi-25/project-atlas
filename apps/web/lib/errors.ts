/**
 * Typed application errors and the API error response shape, matching the
 * catalog in docs/05-api/errors.md exactly (status code + code string).
 * Route handlers throw/return these; nothing else constructs an error
 * response body by hand, so the shape can never drift from the documented
 * contract.
 */

export type ApiErrorCode =
  | 'bad_request'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation_error'
  | 'rate_limited'
  | 'internal_error'
  | 'service_unavailable';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  validation_error: 422,
  rate_limited: 429,
  internal_error: 500,
  service_unavailable: 503,
};

export interface ApiErrorDetail {
  field: string;
  issue: string;
}

export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: ApiErrorDetail[] | undefined;

  constructor(code: ApiErrorCode, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  };
}

/**
 * Builds the exact response body documented in docs/05-api/errors.md.
 * `message` for internal_error is always the generic string below in
 * production — never the underlying exception's message, which could leak
 * implementation detail (stack traces, SQL text, file paths). See
 * docs/05-api/errors.md, principle 1.
 */
export function toApiErrorBody(error: AppError, isProduction: boolean): ApiErrorBody {
  const message =
    error.code === 'internal_error' && isProduction
      ? 'An unexpected error occurred. Please try again or contact support.'
      : error.message;

  return {
    error: {
      code: error.code,
      message,
      ...(error.details ? { details: error.details } : {}),
    },
  };
}

/** Normalizes any thrown value into an AppError, defaulting to internal_error. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new AppError('internal_error', message);
}
