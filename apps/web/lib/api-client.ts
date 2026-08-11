'use client';

/**
 * Minimal client-side fetch wrapper for `/api/v1/` calls from Client
 * Components — same-origin, so the browser sends the session cookie
 * automatically. Throws with the API's own error message on failure so
 * callers can surface it directly; UI authorization reflects backend
 * authorization, but the API/RLS remain authoritative per
 * docs/12-claude/coding-instructions.md.
 */
export interface ApiEnvelope<T> {
  data: T;
  /**
   * `next_cursor`/`has_more` cover cursor-paginated list responses; other
   * routes (e.g. Analytics widgets) attach their own `meta` shape
   * (`as_of`/`is_stale`/`scope`) — the intersection with `Record<string,
   * unknown>` lets callers read those without a second envelope type.
   */
  meta?: { next_cursor?: string | null; has_more?: boolean } & Record<string, unknown>;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await response.json().catch(() => null)) as
    ApiEnvelope<T> | { error: { code: string; message: string } } | null;

  if (!response.ok) {
    const message =
      body && 'error' in body
        ? body.error.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return body as ApiEnvelope<T>;
}
