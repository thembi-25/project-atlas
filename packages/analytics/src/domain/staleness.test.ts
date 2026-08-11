import { describe, expect, it } from 'vitest';
import { describeStaleness, STALENESS_THRESHOLD_MS } from './staleness';

describe('describeStaleness', () => {
  const now = new Date('2026-08-11T12:00:00Z');

  it('is stale with a null asOf when the view has never refreshed', () => {
    expect(describeStaleness(null, now)).toEqual({ asOf: null, isStale: true });
  });

  it('is not stale just after a refresh', () => {
    const result = describeStaleness(new Date('2026-08-11T11:55:00Z'), now);
    expect(result.isStale).toBe(false);
    expect(result.asOf).toEqual(new Date('2026-08-11T11:55:00Z'));
  });

  it('is not stale exactly at the threshold', () => {
    const lastRefreshedAt = new Date(now.getTime() - STALENESS_THRESHOLD_MS);
    expect(describeStaleness(lastRefreshedAt, now).isStale).toBe(false);
  });

  it('is stale just past the threshold', () => {
    const lastRefreshedAt = new Date(now.getTime() - STALENESS_THRESHOLD_MS - 1);
    expect(describeStaleness(lastRefreshedAt, now).isStale).toBe(true);
  });
});
