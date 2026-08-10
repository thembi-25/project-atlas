import { describe, expect, it } from 'vitest';
import {
  centsToDollars,
  computeAmountPaid,
  computeBalanceDue,
  computeLineTotal,
  computeSubtotal,
  computeTotal,
  dollarsToCents,
  roundToCents,
} from './money';

describe('roundToCents', () => {
  it('rounds away floating-point drift', () => {
    expect(roundToCents(0.1 + 0.2)).toBe(0.3);
  });
});

describe('computeLineTotal', () => {
  it('multiplies quantity by unit price and rounds to the cent', () => {
    expect(computeLineTotal(3, 19.99)).toBe(59.97);
  });

  it('handles fractional quantities (e.g. hours)', () => {
    expect(computeLineTotal(1.5, 100)).toBe(150);
  });
});

describe('computeSubtotal', () => {
  it('sums line totals', () => {
    expect(computeSubtotal([59.97, 150, 10.5])).toBe(220.47);
  });

  it('returns 0 for no line items', () => {
    expect(computeSubtotal([])).toBe(0);
  });
});

describe('computeTotal', () => {
  it('adds tax to subtotal', () => {
    expect(computeTotal(220.47, 17.64)).toBe(238.11);
  });
});

describe('computeAmountPaid / computeBalanceDue', () => {
  it('sums payments including negative refunds', () => {
    expect(computeAmountPaid([100, 50, -25])).toBe(125);
  });

  it('computes balance due as total minus amount paid', () => {
    expect(computeBalanceDue(238.11, 125)).toBe(113.11);
  });
});

describe('dollarsToCents / centsToDollars', () => {
  it('round-trips exactly', () => {
    expect(dollarsToCents(19.99)).toBe(1999);
    expect(centsToDollars(1999)).toBe(19.99);
  });
});
