/** Client-side mirror of apps/web/lib/crm-serializers.ts's JSON shape. */
export interface CustomerDto {
  id: string;
  organization_id: string;
  type: 'residential' | 'commercial';
  display_name: string;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_address_city: string | null;
  billing_address_region: string | null;
  billing_address_postal_code: string | null;
  billing_address_country: string | null;
  tags: string[];
  notes: string | null;
  portal_access_enabled: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactDto {
  id: string;
  organization_id: string;
  customer_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role_title: string | null;
  is_primary: boolean;
  portal_access_enabled: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}
