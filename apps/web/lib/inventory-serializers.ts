import type {
  InventoryItem,
  InventoryLocation,
  JobPart,
  LowStockRow,
  StockMovement,
} from '@atlas/inventory';
import type { PurchaseOrder, PurchaseOrderLineItem, Supplier } from '@atlas/suppliers';

/** docs/05-api/resource-conventions.md: response JSON mirrors database column names (snake_case). */
export function serializeInventoryItem(item: InventoryItem) {
  return {
    id: item.id,
    organization_id: item.organizationId,
    sku: item.sku,
    description: item.description,
    asset_type_id: item.assetTypeId,
    unit_cost: item.unitCost,
    default_sell_price: item.defaultSellPrice,
    low_stock_threshold: item.lowStockThreshold,
    is_active: item.isActive,
    created_at: item.createdAt.toISOString(),
    updated_at: item.updatedAt.toISOString(),
  };
}

export function serializeInventoryLocation(location: InventoryLocation) {
  return {
    id: location.id,
    organization_id: location.organizationId,
    type: location.type,
    name: location.name,
    technician_user_id: location.technicianUserId,
    created_at: location.createdAt.toISOString(),
    updated_at: location.updatedAt.toISOString(),
  };
}

export function serializeStockMovement(movement: StockMovement) {
  return {
    id: movement.id,
    organization_id: movement.organizationId,
    inventory_item_id: movement.inventoryItemId,
    location_id: movement.locationId,
    reason: movement.reason,
    quantity_delta: movement.quantityDelta,
    notes: movement.notes,
    created_by_user_id: movement.createdByUserId,
    created_at: movement.createdAt.toISOString(),
  };
}

export function serializeJobPart(jobPart: JobPart) {
  return {
    id: jobPart.id,
    organization_id: jobPart.organizationId,
    job_id: jobPart.jobId,
    inventory_item_id: jobPart.inventoryItemId,
    stock_movement_id: jobPart.stockMovementId,
    quantity: jobPart.quantity,
    unit_cost_at_time: jobPart.unitCostAtTime,
    consumed_by_user_id: jobPart.consumedByUserId,
    created_at: jobPart.createdAt.toISOString(),
  };
}

export function serializeLowStockRow(row: LowStockRow) {
  return {
    inventory_item_id: row.inventoryItemId,
    sku: row.sku,
    description: row.description,
    location_id: row.locationId,
    location_name: row.locationName,
    quantity_on_hand: row.quantityOnHand,
    low_stock_threshold: row.lowStockThreshold,
  };
}

export function serializeSupplier(supplier: Supplier) {
  return {
    id: supplier.id,
    organization_id: supplier.organizationId,
    name: supplier.name,
    contact_name: supplier.contactName,
    email: supplier.email,
    phone: supplier.phone,
    account_number: supplier.accountNumber,
    notes: supplier.notes,
    created_at: supplier.createdAt.toISOString(),
    updated_at: supplier.updatedAt.toISOString(),
  };
}

export function serializePurchaseOrder(po: PurchaseOrder) {
  return {
    id: po.id,
    organization_id: po.organizationId,
    supplier_id: po.supplierId,
    receiving_location_id: po.receivingLocationId,
    status: po.status,
    notes: po.notes,
    ordered_at: po.orderedAt ? po.orderedAt.toISOString() : null,
    received_at: po.receivedAt ? po.receivedAt.toISOString() : null,
    created_by_user_id: po.createdByUserId,
    created_at: po.createdAt.toISOString(),
    updated_at: po.updatedAt.toISOString(),
  };
}

export function serializePurchaseOrderLineItem(item: PurchaseOrderLineItem) {
  return {
    id: item.id,
    purchase_order_id: item.purchaseOrderId,
    inventory_item_id: item.inventoryItemId,
    quantity_ordered: item.quantityOrdered,
    quantity_received: item.quantityReceived,
    unit_cost: item.unitCost,
    sort_order: item.sortOrder,
    created_at: item.createdAt.toISOString(),
    updated_at: item.updatedAt.toISOString(),
  };
}
