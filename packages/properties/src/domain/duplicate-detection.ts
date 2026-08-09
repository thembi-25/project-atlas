/**
 * properties.md business rule 3: "Duplicate Property detection (same
 * address entered twice) is a data-quality concern handled at Property
 * creation (address normalization/geocoding match), not resolved later by
 * merging, since merging would risk silently combining two different
 * Organizations' — or two genuinely different physical locations' — Asset
 * histories." properties-prd.md §16 documents this as a hard block (`422`
 * with a `possible_duplicate` detail) unless the caller explicitly
 * acknowledges the duplicate — a stricter behavior than CRM's
 * non-blocking duplicate flag (customers-prd.md §7/§20), reflecting how
 * much more damaging a merged/duplicated Property's Asset history would
 * be than a merged Customer record.
 *
 * Matching itself (trigram address similarity, exact postal-code match) is
 * a database concern — see infrastructure/properties.ts,
 * `findPotentialDuplicateProperties`. This module holds the one piece of
 * genuine business logic: given a raw match signal, is it worth blocking
 * creation on?
 */

export interface AddressDuplicateSignal {
  /** pg_trgm `similarity()` score for address_line1, 0 (no match) to 1 (identical). */
  addressLine1Similarity: number;
  matchedOnExactPostalCode: boolean;
}

export const ADDRESS_LINE1_SIMILARITY_THRESHOLD = 0.6;

export function isPotentialDuplicateAddress(signal: AddressDuplicateSignal): boolean {
  return (
    signal.addressLine1Similarity >= ADDRESS_LINE1_SIMILARITY_THRESHOLD &&
    signal.matchedOnExactPostalCode
  );
}
