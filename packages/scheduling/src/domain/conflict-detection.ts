/**
 * scheduling.md business rule 2: "The system detects and warns on
 * double-booking... but does not hard-block it." This function is the
 * pure predicate; @atlas/scheduling's infrastructure runs the
 * equivalent check as a SQL range-overlap query (`&&` on `tstzrange`,
 * GiST-indexed — see migration 0017) against the database for the
 * authoritative answer, and only uses this in unit tests to pin down
 * the exact edge-adjacent-window semantics scheduling-prd.md §19 calls
 * for.
 *
 * Half-open interval semantics `[start, end)`: a window ending exactly
 * when another begins is NOT a conflict (back-to-back appointments are
 * normal, not double-booked) — matches the GiST index's `'[)'` bound
 * flag in migration 0017.
 */
export function windowsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
