/** Client-side mirror of apps/web/lib/quickbooks-serializers.ts's JSON shape. Never carries `access_token`/`refresh_token` — see that file's docstring. */
export interface IntegrationConnectionDto {
  id: string;
  organization_id: string;
  provider: 'quickbooks';
  status: 'connected' | 'disconnected';
  realm_id: string | null;
  connected_by_user_id: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncRecordDto {
  id: string;
  organization_id: string;
  provider: 'quickbooks';
  entity_type: string;
  entity_id: string;
  status: 'pending' | 'synced' | 'failed';
  external_id: string | null;
  last_attempted_at: string | null;
  error_detail: string | null;
  created_at: string;
  updated_at: string;
}
