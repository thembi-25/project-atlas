import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { NotFoundError } from '../domain/errors';
import { findPropertyById, type Property } from '../infrastructure/properties';
import {
  listAssetHistoryForProperty,
  type AssetHistoryEntry,
} from '../infrastructure/asset-history';
import { requirePropertiesPermission } from './authorize';

export interface GetPropertyHistoryParams {
  organizationId: string;
  actorUserId: string;
  propertyId: string;
}

export interface PropertyHistoryResult {
  property: Property;
  assets: AssetHistoryEntry[];
  /**
   * properties.md's service-history endpoint documents Jobs as part of
   * the response; Jobs does not exist until Sprint 4, so this is always
   * empty — see docs/13-roadmap/SPRINT-3-COMPLETION-REPORT.md, "Known
   * Limitations." The field is kept in the shape now so the eventual Jobs
   * addition is additive, not a breaking response-shape change.
   */
  jobs: [];
}

/**
 * properties-prd.md §11/§18: history spans every Customer association
 * period — there is deliberately no association-based filter here, only
 * `property_id`, so a Technician sees Assets recorded under a prior
 * Customer relationship too.
 */
export async function getPropertyHistory(
  db: DatabaseClient,
  params: GetPropertyHistoryParams,
): Promise<PropertyHistoryResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'read' });
    const property = await findPropertyById(tx, params.propertyId);
    if (!property || property.organizationId !== params.organizationId) {
      throw new NotFoundError('Property');
    }
    const assets = await listAssetHistoryForProperty(tx, params.propertyId);
    return { property, assets, jobs: [] };
  });
}
