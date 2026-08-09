import type { DatabaseClient } from '@atlas/database';
import { findAssetById, type Asset } from '../infrastructure/assets';

/**
 * Cross-module read for other Organization-scoped modules that need to
 * verify an Asset exists and belongs to the caller's Organization before
 * creating a cross-table reference to it — mirrors @atlas/crm's
 * `findCustomerForOrganization` exactly. Added for @atlas/jobs's
 * `job_assets` join (docs/03-domain/jobs.md: "References zero or more
 * Assets"), Sprint 4.
 */
export async function findAssetForOrganization(
  tx: DatabaseClient,
  params: { organizationId: string; assetId: string },
): Promise<Asset | undefined> {
  const asset = await findAssetById(tx, params.assetId);
  if (!asset || asset.organizationId !== params.organizationId) {
    return undefined;
  }
  return asset;
}
