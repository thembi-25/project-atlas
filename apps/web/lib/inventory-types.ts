/** Client-side mirror of apps/web/lib/inventory-serializers.ts's JSON shape. */
export interface InventoryItemDto {
  id: string;
  organization_id: string;
  sku: string;
  description: string;
  asset_type_id: string | null;
  unit_cost: string;
  default_sell_price: string | null;
  low_stock_threshold: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryItemDetailDto extends InventoryItemDto {
  quantity_by_location: { location_id: string; quantity_on_hand: number }[];
}

export interface InventoryLocationDto {
  id: string;
  organization_id: string;
  type: 'warehouse' | 'truck';
  name: string;
  technician_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockMovementDto {
  id: string;
  organization_id: string;
  inventory_item_id: string;
  location_id: string;
  reason: 'received' | 'consumed_on_job' | 'transferred' | 'adjusted';
  quantity_delta: string;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
}

export interface JobPartDto {
  id: string;
  organization_id: string;
  job_id: string;
  inventory_item_id: string;
  stock_movement_id: string | null;
  quantity: string;
  unit_cost_at_time: string;
  consumed_by_user_id: string | null;
  created_at: string;
  warning?: string | null;
}

export interface LowStockRowDto {
  inventory_item_id: string;
  sku: string;
  description: string;
  location_id: string;
  location_name: string;
  quantity_on_hand: number;
  low_stock_threshold: number;
}

export interface SupplierDto {
  id: string;
  organization_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  account_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderDto {
  id: string;
  organization_id: string;
  supplier_id: string;
  receiving_location_id: string;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  notes: string | null;
  ordered_at: string | null;
  received_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderLineItemDto {
  id: string;
  purchase_order_id: string;
  inventory_item_id: string;
  quantity_ordered: string;
  quantity_received: string;
  unit_cost: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
