/**
 * analytics-prd.md §13/§17: "each widget shows a 'data as of HH:MM'
 * staleness indicator" and "a refresh failure/delay must show the
 * last-known staleness timestamp accurately, never silently displaying
 * outdated data as if current." The Worker refreshes every materialized
 * view on a fixed schedule (apps/worker/src/handlers/analytics-refresh.ts
 * — hourly); a view is considered stale once it's gone more than double
 * that interval without a successful refresh, tolerating one missed cycle
 * before surfacing a problem rather than flapping on ordinary scheduling
 * jitter.
 */
export const REFRESH_INTERVAL_MS = 60 * 60 * 1000;
export const STALENESS_THRESHOLD_MS = REFRESH_INTERVAL_MS * 2;

export interface Staleness {
  /** Timestamp of the last successful refresh, or `null` if the view has never refreshed. */
  asOf: Date | null;
  /** `true` when `asOf` is missing or older than `STALENESS_THRESHOLD_MS`. */
  isStale: boolean;
}

export function describeStaleness(lastRefreshedAt: Date | null, now: Date): Staleness {
  if (!lastRefreshedAt) {
    return { asOf: null, isStale: true };
  }
  const ageMs = now.getTime() - lastRefreshedAt.getTime();
  return { asOf: lastRefreshedAt, isStale: ageMs > STALENESS_THRESHOLD_MS };
}
