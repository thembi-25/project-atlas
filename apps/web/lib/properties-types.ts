/** Client-side mirror of apps/web/lib/properties-serializers.ts's JSON shape. */
export interface PropertyDto {
  id: string;
  organization_id: string;
  property_type: 'residential_single_family' | 'residential_multi_unit' | 'commercial';
  address_line1: string;
  address_line2: string | null;
  address_city: string | null;
  address_region: string | null;
  address_postal_code: string | null;
  address_country: string | null;
  latitude: string | null;
  longitude: string | null;
  access_notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuildingDto {
  id: string;
  organization_id: string;
  property_id: string;
  name: string;
  building_type: 'main' | 'detached_garage' | 'outbuilding' | 'unit' | null;
  floor_count: number | null;
  year_built: number | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomDto {
  id: string;
  organization_id: string;
  building_id: string;
  name: string;
  room_type: 'kitchen' | 'bathroom' | 'utility' | 'attic' | 'basement' | 'garage' | 'other' | null;
  floor_level: number | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyCustomerAssociationDto {
  id: string;
  organization_id: string;
  property_id: string;
  customer_id: string;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
}
