import { describe, expect, it } from 'vitest';
import { isPotentialDuplicateAddress } from './duplicate-detection';

describe('isPotentialDuplicateAddress', () => {
  it('flags a highly similar address line with an exact postal code match', () => {
    expect(
      isPotentialDuplicateAddress({
        addressLine1Similarity: 0.9,
        matchedOnExactPostalCode: true,
      }),
    ).toBe(true);
  });

  it('does not flag a similar address line without a matching postal code', () => {
    expect(
      isPotentialDuplicateAddress({
        addressLine1Similarity: 0.9,
        matchedOnExactPostalCode: false,
      }),
    ).toBe(false);
  });

  it('does not flag a matching postal code with a dissimilar address line', () => {
    expect(
      isPotentialDuplicateAddress({
        addressLine1Similarity: 0.1,
        matchedOnExactPostalCode: true,
      }),
    ).toBe(false);
  });
});
