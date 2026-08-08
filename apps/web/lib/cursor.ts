import { AppError } from './errors';

/**
 * Opaque, base64-encoded cursor token — docs/05-api/pagination.md.
 * Encodes the sort column's value and the row's `id` as a tiebreaker so
 * pagination stays stable even with duplicate sort values.
 */
export interface Cursor {
  sortValue: string;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(token: string): Cursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    throw new AppError('validation_error', 'Invalid pagination cursor.');
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).sortValue !== 'string' ||
    typeof (parsed as Record<string, unknown>).id !== 'string'
  ) {
    throw new AppError('validation_error', 'Invalid pagination cursor.');
  }
  return parsed as Cursor;
}

export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;

/** docs/05-api/pagination.md: default 25, max 100. */
export function parseLimit(rawLimit: string | null): number {
  if (!rawLimit) return DEFAULT_PAGE_LIMIT;
  const parsed = Number(rawLimit);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError('validation_error', 'limit must be a positive integer.', [
      { field: 'limit', issue: 'Must be a positive integer.' },
    ]);
  }
  return Math.min(parsed, MAX_PAGE_LIMIT);
}
