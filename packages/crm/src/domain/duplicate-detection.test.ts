import { describe, expect, it } from 'vitest';
import { isPotentialDuplicate } from './duplicate-detection';

describe('duplicate detection', () => {
  it('flags an exact phone match regardless of name similarity', () => {
    expect(
      isPotentialDuplicate({
        matchedOnExactPhone: true,
        matchedOnExactEmail: false,
        displayNameSimilarity: 0,
      }),
    ).toBe(true);
  });

  it('flags an exact email match regardless of name similarity', () => {
    expect(
      isPotentialDuplicate({
        matchedOnExactPhone: false,
        matchedOnExactEmail: true,
        displayNameSimilarity: 0,
      }),
    ).toBe(true);
  });

  it('flags a sufficiently similar display name with no phone/email match', () => {
    expect(
      isPotentialDuplicate({
        matchedOnExactPhone: false,
        matchedOnExactEmail: false,
        displayNameSimilarity: 0.5,
      }),
    ).toBe(true);
  });

  it('does not flag a coincidental, low-similarity name with no phone/email match', () => {
    expect(
      isPotentialDuplicate({
        matchedOnExactPhone: false,
        matchedOnExactEmail: false,
        displayNameSimilarity: 0.1,
      }),
    ).toBe(false);
  });
});
