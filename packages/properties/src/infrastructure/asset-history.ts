import { sql } from 'drizzle-orm';
import type { DatabaseClient } from '@atlas/database';

/**
 * properties.md, "API requirements": the service-history endpoint returns
 * "all Jobs/Assets for a Property regardless of which Customer association
 * was active at the time." Reads `properties.assets` directly rather than
 * going through @atlas/assets's application layer: component-architecture.md
 * defines exactly one architectural module ("properties") owning
 * `properties`, `buildings`, `rooms`, *and* `assets` together, even though
 * Sprint 0 scaffolded two separate TypeScript packages for file
 * organization — see docs/13-roadmap/SPRINT-3-COMPLETION-REPORT.md,
 * "Architecture Decisions" for the full reasoning. This is a read-only
 * history projection, not the canonical Asset CRUD surface (that stays in
 * @atlas/assets).
 */
export interface AssetHistoryEntry {
  id: string;
  assetTypeId: string;
  manufacturerName: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  installDate: string | null;
  status: 'active' | 'removed' | 'decommissioned';
  buildingId: string | null;
  roomId: string | null;
  createdAt: Date;
}

export async function listAssetHistoryForProperty(
  tx: DatabaseClient,
  propertyId: string,
): Promise<AssetHistoryEntry[]> {
  const rows = await tx.execute<{
    id: string;
    asset_type_id: string;
    manufacturer_name: string | null;
    model_number: string | null;
    serial_number: string | null;
    install_date: string | null;
    status: 'active' | 'removed' | 'decommissioned';
    building_id: string | null;
    room_id: string | null;
    created_at: Date;
  }>(sql`
    SELECT id, asset_type_id, manufacturer_name, model_number, serial_number,
      install_date, status, building_id, room_id, created_at
    FROM properties.assets
    WHERE property_id = ${propertyId}::uuid
      AND deleted_at IS NULL
    ORDER BY created_at ASC
  `);

  return rows.map((row) => ({
    id: row.id,
    assetTypeId: row.asset_type_id,
    manufacturerName: row.manufacturer_name,
    modelNumber: row.model_number,
    serialNumber: row.serial_number,
    installDate: row.install_date,
    status: row.status,
    buildingId: row.building_id,
    roomId: row.room_id,
    createdAt: row.created_at,
  }));
}
