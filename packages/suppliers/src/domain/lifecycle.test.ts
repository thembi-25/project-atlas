import { describe, expect, it } from 'vitest';
import {
  canTransitionPurchaseOrderStatus,
  isTerminalPurchaseOrderStatus,
  PURCHASE_ORDER_STATUSES,
} from './lifecycle';

describe('canTransitionPurchaseOrderStatus — suppliers.md State machine: draft -> ordered -> received (+ cancelled)', () => {
  it('allows draft -> ordered', () => {
    expect(canTransitionPurchaseOrderStatus('draft', 'ordered')).toBe(true);
  });

  it('allows draft -> cancelled', () => {
    expect(canTransitionPurchaseOrderStatus('draft', 'cancelled')).toBe(true);
  });

  it('allows ordered -> received', () => {
    expect(canTransitionPurchaseOrderStatus('ordered', 'received')).toBe(true);
  });

  it('allows ordered -> cancelled', () => {
    expect(canTransitionPurchaseOrderStatus('ordered', 'cancelled')).toBe(true);
  });

  it('rejects draft -> received (skipping ordered)', () => {
    expect(canTransitionPurchaseOrderStatus('draft', 'received')).toBe(false);
  });

  it('rejects any transition out of received (terminal)', () => {
    for (const status of PURCHASE_ORDER_STATUSES) {
      expect(canTransitionPurchaseOrderStatus('received', status)).toBe(false);
    }
  });

  it('rejects any transition out of cancelled (terminal)', () => {
    for (const status of PURCHASE_ORDER_STATUSES) {
      expect(canTransitionPurchaseOrderStatus('cancelled', status)).toBe(false);
    }
  });
});

describe('isTerminalPurchaseOrderStatus', () => {
  it('treats received and cancelled as terminal', () => {
    expect(isTerminalPurchaseOrderStatus('received')).toBe(true);
    expect(isTerminalPurchaseOrderStatus('cancelled')).toBe(true);
  });

  it('treats draft and ordered as non-terminal', () => {
    expect(isTerminalPurchaseOrderStatus('draft')).toBe(false);
    expect(isTerminalPurchaseOrderStatus('ordered')).toBe(false);
  });
});
