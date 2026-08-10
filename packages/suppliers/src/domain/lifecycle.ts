/**
 * The documented Purchase Order state machine —
 * docs/03-domain/suppliers.md, "State machines": `draft -> ordered ->
 * received` (+ `cancelled`), "a simple linear lifecycle, not a complex
 * workflow." `received` and `cancelled` are terminal.
 */
export const PURCHASE_ORDER_STATUSES = ['draft', 'ordered', 'received', 'cancelled'] as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export const TERMINAL_PURCHASE_ORDER_STATUSES: readonly PurchaseOrderStatus[] = [
  'received',
  'cancelled',
];

const VALID_TRANSITIONS: Record<PurchaseOrderStatus, readonly PurchaseOrderStatus[]> = {
  draft: ['ordered', 'cancelled'],
  ordered: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

export function canTransitionPurchaseOrderStatus(
  from: PurchaseOrderStatus,
  to: PurchaseOrderStatus,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function isTerminalPurchaseOrderStatus(status: PurchaseOrderStatus): boolean {
  return TERMINAL_PURCHASE_ORDER_STATUSES.includes(status);
}
