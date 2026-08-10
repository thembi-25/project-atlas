/**
 * Inventory domain module for Project Atlas — Sprint 6 (Inventory &
 * Suppliers). See docs/03-domain/inventory.md, docs/06-modules/
 * inventory-prd.md, docs/13-roadmap/sprint-6.md.
 */

export { NotFoundError, ForbiddenError, InvalidStockMovementError } from './domain/errors';
export {
  computeQuantityOnHand,
  checkSufficientStock,
  validateStockMovementInput,
  type StockMovementReason,
} from './domain/stock';

export {
  type InventoryItem,
  type InventoryItemCursor,
  type InventoryItemSortField,
  type SortDirection,
} from './infrastructure/inventory-items';
export {
  type InventoryLocation,
  type InventoryLocationType,
} from './infrastructure/inventory-locations';
export { type StockMovement } from './infrastructure/stock-movements';
export { type JobPart } from './infrastructure/job-parts';

export { requireInventoryPermission, requireInventoryConsumeAccess } from './application/authorize';
export {
  createInventoryItem,
  getInventoryItem,
  listInventoryItems,
  updateInventoryItem,
  deleteInventoryItem,
} from './application/manage-inventory-items';
export {
  createInventoryLocation,
  listInventoryLocations,
  updateInventoryLocation,
  deleteInventoryLocation,
} from './application/manage-inventory-locations';
export { adjustStock, transferStock } from './application/adjust-stock';
export { consumePart, type ConsumePartResult } from './application/consume-part';
export { listJobParts } from './application/list-job-parts';
export { listLowStockItems, type LowStockRow } from './application/low-stock';

export { findInventoryItemById } from './infrastructure/inventory-items';
export { findInventoryLocationById } from './infrastructure/inventory-locations';
export { insertStockMovement, getQuantityOnHand } from './infrastructure/stock-movements';
