/** Client-side mirror of apps/web/lib/assets-serializers.ts's JSON shape. */
export interface AssetDto {
  id: string;
  organization_id: string;
  property_id: string;
  building_id: string | null;
  room_id: string | null;
  asset_type_id: string;
  manufacturer_name: string | null;
  model_number: string | null;
  serial_number: string | null;
  install_date: string | null;
  status: 'active' | 'removed' | 'decommissioned';
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetTypeDto {
  id: string;
  organization_id: string | null;
  trade_type_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
