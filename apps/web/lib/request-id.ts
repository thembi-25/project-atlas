export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Returns the inbound request ID if the caller/proxy supplied one,
 * otherwise mints a fresh one. Every response carries this back as
 * `X-Request-Id` per docs/05-api/errors.md, and it's the correlation key
 * threaded through structured logs — see docs/10-devops/logging.md.
 */
export function resolveRequestId(headers: Headers): string {
  return headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
}
