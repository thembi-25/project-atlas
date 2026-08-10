export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} not found.`);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** suppliers.md, State Machine: an attempted transition not drawn in the documented `draft -> ordered -> received` (+ `cancelled`) diagram. */
export class InvalidPurchaseOrderStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPurchaseOrderStateError';
  }
}

/** suppliers-prd.md §16: "marking a Purchase Order received with mismatched line-item quantities (422), requires explicit partial-receipt handling rather than silently accepting a mismatch." */
export class PurchaseOrderReceiptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PurchaseOrderReceiptError';
  }
}
