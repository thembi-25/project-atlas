import { describe, expect, it } from 'vitest';
import { checkSufficientStock, computeQuantityOnHand, validateStockMovementInput } from './stock';
import { InvalidStockMovementError } from './errors';

describe('computeQuantityOnHand', () => {
  it('sums an empty ledger to zero', () => {
    expect(computeQuantityOnHand([])).toBe(0);
  });

  it('sums received, consumed, and adjusted movements — inventory.md business rule 1', () => {
    expect(computeQuantityOnHand([10, -2, -1, 5])).toBe(12);
  });

  it('never goes negative just because the sum does — the derivation is pure arithmetic, not clamped', () => {
    expect(computeQuantityOnHand([5, -8])).toBe(-3);
  });
});

describe('validateStockMovementInput', () => {
  it('rejects a zero quantity delta', () => {
    expect(() =>
      validateStockMovementInput({ reason: 'adjusted', quantityDelta: 0, notes: 'count' }),
    ).toThrow(InvalidStockMovementError);
  });

  it('rejects a non-finite quantity delta', () => {
    expect(() =>
      validateStockMovementInput({ reason: 'received', quantityDelta: Number.NaN }),
    ).toThrow(InvalidStockMovementError);
  });

  it('rejects a "received" movement with a non-positive quantity — inventory-prd.md §16', () => {
    expect(() => validateStockMovementInput({ reason: 'received', quantityDelta: -5 })).toThrow(
      InvalidStockMovementError,
    );
  });

  it('accepts a "received" movement with a positive quantity', () => {
    expect(() =>
      validateStockMovementInput({ reason: 'received', quantityDelta: 10 }),
    ).not.toThrow();
  });

  it('rejects a "consumed_on_job" movement with a non-negative quantity', () => {
    expect(() =>
      validateStockMovementInput({ reason: 'consumed_on_job', quantityDelta: 3 }),
    ).toThrow(InvalidStockMovementError);
  });

  it('rejects an "adjusted" movement without a reason in notes — inventory.md Edge Cases', () => {
    expect(() => validateStockMovementInput({ reason: 'adjusted', quantityDelta: -2 })).toThrow(
      InvalidStockMovementError,
    );
    expect(() =>
      validateStockMovementInput({ reason: 'adjusted', quantityDelta: -2, notes: '   ' }),
    ).toThrow(InvalidStockMovementError);
  });

  it('accepts an "adjusted" movement with a reason', () => {
    expect(() =>
      validateStockMovementInput({
        reason: 'adjusted',
        quantityDelta: -2,
        notes: 'Physical count found 2 fewer units.',
      }),
    ).not.toThrow();
  });

  it('accepts a "transferred" movement in either direction', () => {
    expect(() =>
      validateStockMovementInput({ reason: 'transferred', quantityDelta: -4 }),
    ).not.toThrow();
    expect(() =>
      validateStockMovementInput({ reason: 'transferred', quantityDelta: 4 }),
    ).not.toThrow();
  });
});

describe('checkSufficientStock', () => {
  it('returns undefined when quantity on hand covers the consumption', () => {
    expect(checkSufficientStock({ quantityOnHand: 5, quantityToConsume: 2 })).toBeUndefined();
  });

  it('returns undefined when consumption exactly exhausts quantity on hand', () => {
    expect(checkSufficientStock({ quantityOnHand: 5, quantityToConsume: 5 })).toBeUndefined();
  });

  it('returns a warning string (never throws) when consumption would go negative — inventory.md business rule 2', () => {
    const warning = checkSufficientStock({ quantityOnHand: 2, quantityToConsume: 5 });
    expect(warning).toBeDefined();
    expect(warning).toContain('-3');
  });
});
