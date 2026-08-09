import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { listAssetTypesForOrganization, type AssetType } from '../infrastructure/asset-types';
import { requireAssetsPermission } from './authorize';

export interface ListAssetTypesParams {
  organizationId: string;
  actorUserId: string;
}

/** Read-only catalog listing for the Asset-creation form — platform defaults plus this Organization's own extensions. */
export async function listAssetTypes(
  db: DatabaseClient,
  params: ListAssetTypesParams,
): Promise<AssetType[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireAssetsPermission(tx, { ...params, action: 'read' });
    return listAssetTypesForOrganization(tx, params.organizationId);
  });
}
