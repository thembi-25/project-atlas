import { sql } from 'drizzle-orm';
import type { DatabaseClient } from '@atlas/database';

/**
 * Verifies the Property/Building/Room an Asset is being linked to exists,
 * is not soft-deleted, and belongs to the acting Organization, before an
 * Asset row is inserted/updated to reference it. Queries
 * `properties.properties`/`buildings`/`rooms` directly rather than
 * through @atlas/properties's application layer: component-architecture.md
 * defines exactly one architectural module ("properties") owning all four
 * `properties`-schema tables together, even though Sprint 0 scaffolded
 * two separate TypeScript packages — see
 * docs/13-roadmap/SPRINT-3-COMPLETION-REPORT.md, "Architecture
 * Decisions." This is defense-in-depth alongside the database's own RLS
 * `WITH CHECK` clauses on `properties.assets` (migration
 * 0010_properties_rls_search_and_audit.sql), which independently enforce
 * the same property/building/room/organization consistency at the
 * database level — see docs/07-security/tenant-isolation.md: "Do not
 * assume that application-level foreign-key checks are sufficient,"
 * applied here in the other direction (RLS alone is not sufficient
 * either — the application layer should also produce a clear 404 rather
 * than a raw constraint-violation error).
 */
export async function propertyExistsForOrganization(
  tx: DatabaseClient,
  organizationId: string,
  propertyId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM properties.properties
      WHERE id = ${propertyId}::uuid
        AND organization_id = ${organizationId}::uuid
        AND deleted_at IS NULL
    ) AS exists
  `);
  return rows[0]?.exists ?? false;
}

/** Also verifies the Building belongs to the given Property (not just the Organization). */
export async function buildingExistsForProperty(
  tx: DatabaseClient,
  organizationId: string,
  propertyId: string,
  buildingId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM properties.buildings
      WHERE id = ${buildingId}::uuid
        AND property_id = ${propertyId}::uuid
        AND organization_id = ${organizationId}::uuid
        AND deleted_at IS NULL
    ) AS exists
  `);
  return rows[0]?.exists ?? false;
}

/** Also verifies the Room belongs to the given Building (not just the Organization). */
export async function roomExistsForBuilding(
  tx: DatabaseClient,
  organizationId: string,
  buildingId: string,
  roomId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM properties.rooms
      WHERE id = ${roomId}::uuid
        AND building_id = ${buildingId}::uuid
        AND organization_id = ${organizationId}::uuid
        AND deleted_at IS NULL
    ) AS exists
  `);
  return rows[0]?.exists ?? false;
}
