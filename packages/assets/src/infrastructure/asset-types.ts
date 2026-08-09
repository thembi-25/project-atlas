import { and, eq, isNull, or } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type AssetType = typeof schema.assetTypes.$inferSelect;

/**
 * Platform defaults (`organization_id IS NULL`) plus this Organization's
 * own extensions — assets.md: "Organization-scoped, extensible from
 * platform defaults." Org-authored custom Asset Types are not
 * create/update-able this sprint (see
 * docs/13-roadmap/SPRINT-3-COMPLETION-REPORT.md, "Known Limitations");
 * this is a read-only catalog listing.
 */
export async function listAssetTypesForOrganization(
  tx: DatabaseClient,
  organizationId: string,
): Promise<AssetType[]> {
  return tx
    .select()
    .from(schema.assetTypes)
    .where(
      and(
        or(
          isNull(schema.assetTypes.organizationId),
          eq(schema.assetTypes.organizationId, organizationId),
        ),
        eq(schema.assetTypes.isActive, true),
      ),
    )
    .orderBy(schema.assetTypes.name);
}

export async function findAssetTypeById(
  tx: DatabaseClient,
  assetTypeId: string,
): Promise<AssetType | undefined> {
  const [assetType] = await tx
    .select()
    .from(schema.assetTypes)
    .where(eq(schema.assetTypes.id, assetTypeId))
    .limit(1);
  return assetType;
}

/** True when the Asset Type is a platform default or belongs to this Organization. */
export function assetTypeVisibleToOrganization(
  assetType: AssetType,
  organizationId: string,
): boolean {
  return assetType.organizationId === null || assetType.organizationId === organizationId;
}
