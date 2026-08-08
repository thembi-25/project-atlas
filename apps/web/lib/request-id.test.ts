import { describe, expect, it } from 'vitest';
import { resolveRequestId } from './request-id';

describe('resolveRequestId', () => {
  it('echoes an inbound X-Request-Id header', () => {
    const headers = new Headers({ 'x-request-id': 'abc-123' });
    expect(resolveRequestId(headers)).toBe('abc-123');
  });

  it('mints a UUID when no header is present', () => {
    const headers = new Headers();
    const id = resolveRequestId(headers);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('mints a different ID on each call when absent', () => {
    const headers = new Headers();
    expect(resolveRequestId(headers)).not.toBe(resolveRequestId(headers));
  });
});
