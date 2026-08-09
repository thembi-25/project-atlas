-- Properties & Assets (Sprint 3): search infrastructure, RLS, and audit
-- triggers for properties.{properties, property_customer_associations,
-- buildings, rooms, asset_types, assets}. See
-- docs/02-architecture/search-strategy.md, docs/04-database/indexes.md,
-- docs/04-database/multi-tenancy.md, docs/07-security/tenant-isolation.md,
-- docs/04-database/audit-logging.md, docs/13-roadmap/sprint-3.md.
--
-- All six tables carry organization_id directly (see
-- packages/database/src/schema/properties.ts), so every RLS policy here
-- is a single-table app.current_user_has_permission() check plus, on
-- INSERT/UPDATE, an EXISTS check that every referenced parent row
-- (Property, Customer, Building, Room) actually belongs to the same
-- claimed organization_id — this is what prevents "Tenant A attaches a
-- Property to Tenant B's Customer" / "attaches an Asset to Tenant B's
-- Property" even though the indirect ownership chain (Asset -> Room ->
-- Building -> Property -> Organization) is four joins deep.

-- search_vector — docs/02-architecture/search-strategy.md: "Property |
-- address (street, city, postal code)", "Asset | manufacturer, model,
-- serial number".
ALTER TABLE "properties"."properties" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(address_line1, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(address_city, '')), 'B')
    || setweight(to_tsvector('simple', coalesce(address_postal_code, '')), 'B')
  ) STORED;
--> statement-breakpoint

ALTER TABLE "properties"."assets" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(manufacturer_name, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(model_number, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(serial_number, '')), 'A')
  ) STORED;
--> statement-breakpoint

-- Indexes — docs/04-database/indexes.md's explicit table for this module:
-- "properties | (organization_id, deleted_at); GIN search_vector on
-- address"; "property_customer_associations | (property_id, effective_to);
-- (customer_id, effective_to)"; "assets | (property_id); (organization_id)".
CREATE INDEX "idx_properties_organization_id_deleted_at" ON "properties"."properties" ("organization_id", "deleted_at");
--> statement-breakpoint
CREATE INDEX "idx_properties_search_vector" ON "properties"."properties" USING GIN ("search_vector");
--> statement-breakpoint
CREATE INDEX "idx_properties_address_line1_trgm" ON "properties"."properties" USING GIN ("address_line1" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "idx_pca_property_id_effective_to" ON "properties"."property_customer_associations" ("property_id", "effective_to");
--> statement-breakpoint
CREATE INDEX "idx_pca_customer_id_effective_to" ON "properties"."property_customer_associations" ("customer_id", "effective_to");
--> statement-breakpoint
CREATE INDEX "idx_pca_organization_id" ON "properties"."property_customer_associations" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_buildings_property_id" ON "properties"."buildings" ("property_id");
--> statement-breakpoint
CREATE INDEX "idx_buildings_organization_id" ON "properties"."buildings" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_rooms_building_id" ON "properties"."rooms" ("building_id");
--> statement-breakpoint
CREATE INDEX "idx_rooms_organization_id" ON "properties"."rooms" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_property_id" ON "properties"."assets" ("property_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_organization_id" ON "properties"."assets" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_building_id" ON "properties"."assets" ("building_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_room_id" ON "properties"."assets" ("room_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_status" ON "properties"."assets" ("organization_id", "status");
--> statement-breakpoint
CREATE INDEX "idx_assets_search_vector" ON "properties"."assets" USING GIN ("search_vector");
--> statement-breakpoint
CREATE INDEX "idx_assets_serial_number_trgm" ON "properties"."assets" USING GIN ("serial_number" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "idx_asset_types_trade_type_id" ON "properties"."asset_types" ("trade_type_id");
--> statement-breakpoint

-- properties.properties
ALTER TABLE "properties"."properties" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "properties"."properties" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY properties_select ON "properties"."properties"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'properties', 'read'));
--> statement-breakpoint
CREATE POLICY properties_insert ON "properties"."properties"
  FOR INSERT TO authenticated
  WITH CHECK (app.current_user_has_permission(organization_id, 'properties', 'write'));
--> statement-breakpoint
CREATE POLICY properties_update ON "properties"."properties"
  FOR UPDATE TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'properties', 'write')
    OR app.current_user_has_permission(organization_id, 'properties', 'delete')
  )
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'properties', 'write')
    OR app.current_user_has_permission(organization_id, 'properties', 'delete')
  );
--> statement-breakpoint
CREATE TRIGGER audit_properties
  AFTER INSERT OR UPDATE OR DELETE ON "properties"."properties"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- properties.property_customer_associations: WITH CHECK verifies both the
-- referenced Property and the referenced (crm-schema) Customer actually
-- belong to the claimed organization_id — the "Tenant A cannot attach a
-- Property to Tenant B's Customer" guarantee.
ALTER TABLE "properties"."property_customer_associations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "properties"."property_customer_associations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY pca_select ON "properties"."property_customer_associations"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'properties', 'read'));
--> statement-breakpoint
CREATE POLICY pca_insert ON "properties"."property_customer_associations"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'properties', 'write')
    AND EXISTS (
      SELECT 1 FROM properties.properties p
      WHERE p.id = property_customer_associations.property_id
        AND p.organization_id = property_customer_associations.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM crm.customers c
      WHERE c.id = property_customer_associations.customer_id
        AND c.organization_id = property_customer_associations.organization_id
    )
  );
--> statement-breakpoint
CREATE POLICY pca_update ON "properties"."property_customer_associations"
  FOR UPDATE TO authenticated
  USING (app.current_user_has_permission(organization_id, 'properties', 'write'))
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'properties', 'write')
    AND EXISTS (
      SELECT 1 FROM properties.properties p
      WHERE p.id = property_customer_associations.property_id
        AND p.organization_id = property_customer_associations.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM crm.customers c
      WHERE c.id = property_customer_associations.customer_id
        AND c.organization_id = property_customer_associations.organization_id
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_property_customer_associations
  AFTER INSERT OR UPDATE OR DELETE ON "properties"."property_customer_associations"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- properties.buildings: same Permission set as Properties (no independent
-- Building-level permission — docs/03-domain/buildings.md).
ALTER TABLE "properties"."buildings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "properties"."buildings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY buildings_select ON "properties"."buildings"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'properties', 'read'));
--> statement-breakpoint
CREATE POLICY buildings_insert ON "properties"."buildings"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'properties', 'write')
    AND EXISTS (
      SELECT 1 FROM properties.properties p
      WHERE p.id = buildings.property_id
        AND p.organization_id = buildings.organization_id
    )
  );
--> statement-breakpoint
CREATE POLICY buildings_update ON "properties"."buildings"
  FOR UPDATE TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'properties', 'write')
    OR app.current_user_has_permission(organization_id, 'properties', 'delete')
  )
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'properties', 'write')
    OR app.current_user_has_permission(organization_id, 'properties', 'delete')
  );
--> statement-breakpoint
CREATE TRIGGER audit_buildings
  AFTER INSERT OR UPDATE OR DELETE ON "properties"."buildings"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- properties.rooms: same Permission set (docs/03-domain/rooms.md — no
-- independent Room-level permission).
ALTER TABLE "properties"."rooms" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "properties"."rooms" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY rooms_select ON "properties"."rooms"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'properties', 'read'));
--> statement-breakpoint
CREATE POLICY rooms_insert ON "properties"."rooms"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'properties', 'write')
    AND EXISTS (
      SELECT 1 FROM properties.buildings b
      WHERE b.id = rooms.building_id
        AND b.organization_id = rooms.organization_id
    )
  );
--> statement-breakpoint
CREATE POLICY rooms_update ON "properties"."rooms"
  FOR UPDATE TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'properties', 'write')
    OR app.current_user_has_permission(organization_id, 'properties', 'delete')
  )
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'properties', 'write')
    OR app.current_user_has_permission(organization_id, 'properties', 'delete')
  );
--> statement-breakpoint
CREATE TRIGGER audit_rooms
  AFTER INSERT OR UPDATE OR DELETE ON "properties"."rooms"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- properties.asset_types: cross-tenant platform+org reference data,
-- mirroring identity.roles/permissions from Sprint 1 — readable by every
-- authenticated Organization member (platform defaults, organization_id
-- IS NULL, plus that Organization's own rows); no write policy for
-- `authenticated` since org-authored custom Asset Types are not
-- implemented this sprint (see SPRINT-3-COMPLETION-REPORT.md, "Known
-- Limitations") — writes happen only via the service-role-backed seed
-- migration, same as Sprint 1's roles/permissions tables.
ALTER TABLE "properties"."asset_types" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "properties"."asset_types" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY asset_types_select ON "properties"."asset_types"
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR app.current_user_has_permission(organization_id, 'properties', 'read')
  );
--> statement-breakpoint

-- properties.assets: same Permission set as Properties
-- (docs/03-domain/assets.md, "Same visibility rules as the parent
-- Property"). WITH CHECK verifies the referenced Property, and if given,
-- the referenced Building/Room, all belong to the same claimed
-- organization_id — the "Tenant A cannot attach an Asset to Tenant B's
-- Property" guarantee.
ALTER TABLE "properties"."assets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "properties"."assets" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY assets_select ON "properties"."assets"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'assets', 'read'));
--> statement-breakpoint
CREATE POLICY assets_insert ON "properties"."assets"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'assets', 'write')
    AND EXISTS (
      SELECT 1 FROM properties.properties p
      WHERE p.id = assets.property_id
        AND p.organization_id = assets.organization_id
    )
    AND (
      assets.building_id IS NULL
      OR EXISTS (
        SELECT 1 FROM properties.buildings b
        WHERE b.id = assets.building_id
          AND b.organization_id = assets.organization_id
          AND b.property_id = assets.property_id
      )
    )
    AND (
      assets.room_id IS NULL
      OR EXISTS (
        SELECT 1 FROM properties.rooms r
        WHERE r.id = assets.room_id
          AND r.organization_id = assets.organization_id
          AND (assets.building_id IS NULL OR r.building_id = assets.building_id)
      )
    )
  );
--> statement-breakpoint
CREATE POLICY assets_update ON "properties"."assets"
  FOR UPDATE TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'assets', 'write')
    OR app.current_user_has_permission(organization_id, 'assets', 'delete')
  )
  WITH CHECK (
    (
      app.current_user_has_permission(organization_id, 'assets', 'write')
      OR app.current_user_has_permission(organization_id, 'assets', 'delete')
    )
    AND EXISTS (
      SELECT 1 FROM properties.properties p
      WHERE p.id = assets.property_id
        AND p.organization_id = assets.organization_id
    )
    AND (
      assets.building_id IS NULL
      OR EXISTS (
        SELECT 1 FROM properties.buildings b
        WHERE b.id = assets.building_id
          AND b.organization_id = assets.organization_id
          AND b.property_id = assets.property_id
      )
    )
    AND (
      assets.room_id IS NULL
      OR EXISTS (
        SELECT 1 FROM properties.rooms r
        WHERE r.id = assets.room_id
          AND r.organization_id = assets.organization_id
          AND (assets.building_id IS NULL OR r.building_id = assets.building_id)
      )
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_assets
  AFTER INSERT OR UPDATE OR DELETE ON "properties"."assets"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
