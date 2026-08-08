/**
 * customers-prd.md §7/§20: "merge-duplicate-detection prompt at creation
 * (does not auto-merge)." Atlas never assumes phone/email alone uniquely
 * identifies a Customer (Customers are Organization-scoped, not globally
 * deduplicated — see docs/03-domain/customers.md business rule 1), so this
 * is detection-and-flag only, never a blocking uniqueness constraint and
 * never a silent merge/discard.
 *
 * Matching itself (exact phone/email lookups, trigram name similarity) is
 * a database concern — see infrastructure/customers.ts,
 * `findPotentialDuplicateCustomers`. This module holds the one piece of
 * genuine business logic: given a raw match signal, is it worth
 * surfacing to the user as a potential duplicate?
 */

export interface DuplicateSignal {
  matchedOnExactPhone: boolean;
  matchedOnExactEmail: boolean;
  /** pg_trgm `similarity()` score for display_name, 0 (no match) to 1 (identical). */
  displayNameSimilarity: number;
}

/**
 * Below this, two names are considered coincidentally similar rather than
 * a likely duplicate (e.g., "Smith" vs "Smyth" scores well above this;
 * unrelated short common names typically score below it).
 */
export const DISPLAY_NAME_SIMILARITY_THRESHOLD = 0.4;

export function isPotentialDuplicate(signal: DuplicateSignal): boolean {
  return (
    signal.matchedOnExactPhone ||
    signal.matchedOnExactEmail ||
    signal.displayNameSimilarity >= DISPLAY_NAME_SIMILARITY_THRESHOLD
  );
}
