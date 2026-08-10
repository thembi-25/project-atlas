/**
 * Suppliers domain module for Project Atlas — Sprint 6 (Inventory &
 * Suppliers). See docs/03-domain/suppliers.md, docs/06-modules/
 * suppliers-prd.md, docs/13-roadmap/sprint-6.md.
 */

export {
  NotFoundError,
  ForbiddenError,
  InvalidPurchaseOrderStateError,
  PurchaseOrderReceiptError,
} from './domain/errors';
export {
  PURCHASE_ORDER_STATUSES,
  canTransitionPurchaseOrderStatus,
  isTerminalPurchaseOrderStatus,
  type PurchaseOrderStatus,
} from './domain/lifecycle';

export {
  type Supplier,
  type SupplierCursor,
  type SupplierSortField,
  type SortDirection,
} from './infrastructure/suppliers';
export { type PurchaseOrder } from './infrastructure/purchase-orders';
export { type PurchaseOrderLineItem } from './infrastructure/purchase-order-line-items';

export { requireInventoryPermission } from './application/authorize';
export {
  createSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
  deleteSupplier,
} from './application/manage-suppliers';
export {
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  updatePurchaseOrder,
  type PurchaseOrderWithLineItems,
  type CreatePurchaseOrderLineItemInput,
} from './application/manage-purchase-orders';
export {
  markPurchaseOrderOrdered,
  cancelPurchaseOrder,
  receivePurchaseOrder,
  type ReceivePurchaseOrderLineInput,
  type ReceivePurchaseOrderResult,
} from './application/purchase-order-transitions';
