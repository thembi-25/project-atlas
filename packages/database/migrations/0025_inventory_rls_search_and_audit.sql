-- Inventory & Suppliers (Sprint 6): indexes, RLS, and audit triggers for
-- inventory.{inventory_items, inventory_locations, stock_movements,
-- job_parts, suppliers, purchase_orders, purchase_order_line_items}. See
-- docs/04-database/indexes.md, docs/04-database/multi-tenancy.md,
-- docs/07-security/tenant-isolation.md, docs/04-database/audit-logging.md,
-- docs/13-roadmap/sprint-6.md.
--
-- No `search_vector` column is added to any inventory table: neither
-- inventory-prd.md nor suppliers-prd.md documents a full-text search
-- requirement (unlike Jobs/Customers/Properties), so none is built,
-- mirroring migration 0021's identical reasoning for financials.
--
-- Permission model recap (docs/03-domain/permissions.md,
-- docs/03-domain/roles.md — a single combined `inventory` resource,
-- `read`/`write`/`consume`, with no separate `suppliers` resource; see
-- sprint-6.md, "Scope decisions"): `inventory:write` gates all
-- master-data management (Items, Locations, Suppliers, Purchase
-- Orders — Owner/Admin only, per the already-applied Sprint 1 seed).
-- `inventory:consume` gates `job_parts` creation (Technician,
-- restricted to Jobs they're assigned to, enforced below exactly like
-- migration 0017's `jobs:write_assigned` pattern via a
-- `jobs.job_assignments` EXISTS join) or any actor who also holds
-- `inventory:write` (Owner/Admin, unrestricted).
--
-- `inventory.stock_movements` has no job_id column (job linkage lives on
-- `job_parts`, which references both `job_id` and `stock_movement_id`),
-- so its own INSERT policy can only check the `inventory:write`/
-- `inventory:consume` resource-level grant, not per-job assignment — the
-- per-job assignment restriction for consumption is enforced at the
-- `job_parts` INSERT policy (which does have `job_id`) and, in
-- @atlas/inventory's application layer, checked before either row is
-- written in the same transaction. This is the same two-layer
-- enforcement (API layer + RLS, neither substituting for the other) used
-- throughout every prior sprint — see docs/03-domain/permissions.md,
-- "Enforcement points."

-- Indexes — FK-covering indexes added proactively (Sprint 5 precedent),
-- plus indexes.md's explicit table: "stock_movements |
-- (inventory_item_id, location_id, created_at) | Quantity-on-hand
-- computation" (the `uq_inventory_items_org_sku` unique index already
-- covers `inventory_items`' documented `(organization_id, sku)` need,
-- created in migration 0024).
CREATE INDEX "idx_inventory_items_asset_type_id" ON "inventory"."inventory_items" ("asset_type_id");
--> statement-breakpoint
CREATE INDEX "idx_inventory_locations_organization_id" ON "inventory"."inventory_locations" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_inventory_locations_technician_user_id" ON "inventory"."inventory_locations" ("technician_user_id");
--> statement-breakpoint
CREATE INDEX "idx_stock_movements_item_location_created" ON "inventory"."stock_movements" ("inventory_item_id", "location_id", "created_at");
--> statement-breakpoint
CREATE INDEX "idx_stock_movements_organization_id" ON "inventory"."stock_movements" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_stock_movements_created_by_user_id" ON "inventory"."stock_movements" ("created_by_user_id");
--> statement-breakpoint
CREATE INDEX "idx_job_parts_organization_id" ON "inventory"."job_parts" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_job_parts_job_id" ON "inventory"."job_parts" ("job_id");
--> statement-breakpoint
CREATE INDEX "idx_job_parts_inventory_item_id" ON "inventory"."job_parts" ("inventory_item_id");
--> statement-breakpoint
CREATE INDEX "idx_job_parts_stock_movement_id" ON "inventory"."job_parts" ("stock_movement_id");
--> statement-breakpoint
CREATE INDEX "idx_job_parts_consumed_by_user_id" ON "inventory"."job_parts" ("consumed_by_user_id");
--> statement-breakpoint
CREATE INDEX "idx_suppliers_organization_id" ON "inventory"."suppliers" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_purchase_orders_organization_id" ON "inventory"."purchase_orders" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_purchase_orders_supplier_id" ON "inventory"."purchase_orders" ("supplier_id");
--> statement-breakpoint
CREATE INDEX "idx_purchase_orders_receiving_location_id" ON "inventory"."purchase_orders" ("receiving_location_id");
--> statement-breakpoint
CREATE INDEX "idx_purchase_orders_created_by_user_id" ON "inventory"."purchase_orders" ("created_by_user_id");
--> statement-breakpoint
CREATE INDEX "idx_purchase_order_line_items_organization_id" ON "inventory"."purchase_order_line_items" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_purchase_order_line_items_purchase_order_id" ON "inventory"."purchase_order_line_items" ("purchase_order_id");
--> statement-breakpoint
CREATE INDEX "idx_purchase_order_line_items_inventory_item_id" ON "inventory"."purchase_order_line_items" ("inventory_item_id");
--> statement-breakpoint

-- inventory.inventory_items: SELECT on inventory:read; INSERT/UPDATE on
-- inventory:write. No DELETE policy — deletion is soft (`deleted_at`
-- UPDATE), matching `properties.properties`/`crm.customers` precedent.
ALTER TABLE "inventory"."inventory_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "inventory"."inventory_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY inventory_items_select ON "inventory"."inventory_items"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'inventory', 'read'));
--> statement-breakpoint
CREATE POLICY inventory_items_insert ON "inventory"."inventory_items"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'inventory', 'write')
    AND (
      asset_type_id IS NULL
      OR EXISTS (
        SELECT 1 FROM properties.asset_types at
        WHERE at.id = inventory_items.asset_type_id
          AND (at.organization_id = inventory_items.organization_id OR at.organization_id IS NULL)
      )
    )
  );
--> statement-breakpoint
CREATE POLICY inventory_items_update ON "inventory"."inventory_items"
  FOR UPDATE TO authenticated
  USING (app.current_user_has_permission(organization_id, 'inventory', 'write'))
  WITH CHECK (app.current_user_has_permission(organization_id, 'inventory', 'write'));
--> statement-breakpoint
CREATE TRIGGER audit_inventory_items
  AFTER INSERT OR UPDATE OR DELETE ON "inventory"."inventory_items"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- inventory.inventory_locations: same shape as inventory_items.
ALTER TABLE "inventory"."inventory_locations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "inventory"."inventory_locations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY inventory_locations_select ON "inventory"."inventory_locations"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'inventory', 'read'));
--> statement-breakpoint
CREATE POLICY inventory_locations_insert ON "inventory"."inventory_locations"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'inventory', 'write')
    AND (
      technician_user_id IS NULL
      OR EXISTS (
        SELECT 1 FROM identity.organization_memberships m
        WHERE m.user_id = inventory_locations.technician_user_id
          AND m.organization_id = inventory_locations.organization_id
          AND m.status = 'active'
      )
    )
  );
--> statement-breakpoint
CREATE POLICY inventory_locations_update ON "inventory"."inventory_locations"
  FOR UPDATE TO authenticated
  USING (app.current_user_has_permission(organization_id, 'inventory', 'write'))
  WITH CHECK (app.current_user_has_permission(organization_id, 'inventory', 'write'));
--> statement-breakpoint
CREATE TRIGGER audit_inventory_locations
  AFTER INSERT OR UPDATE OR DELETE ON "inventory"."inventory_locations"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- inventory.stock_movements: append-only (no UPDATE/DELETE policy — see
-- header comment for why the per-job-assignment restriction on
-- `consumed_on_job` movements is enforced via `job_parts`, not here).
ALTER TABLE "inventory"."stock_movements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY stock_movements_select ON "inventory"."stock_movements"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'inventory', 'read'));
--> statement-breakpoint
CREATE POLICY stock_movements_insert ON "inventory"."stock_movements"
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      app.current_user_has_permission(organization_id, 'inventory', 'write')
      OR app.current_user_has_permission(organization_id, 'inventory', 'consume')
    )
    AND EXISTS (
      SELECT 1 FROM inventory.inventory_items ii
      WHERE ii.id = stock_movements.inventory_item_id AND ii.organization_id = stock_movements.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM inventory.inventory_locations il
      WHERE il.id = stock_movements.location_id AND il.organization_id = stock_movements.organization_id
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_stock_movements
  AFTER INSERT ON "inventory"."stock_movements"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- inventory.job_parts: append-only (no UPDATE/DELETE policy). INSERT
-- enforces the Technician-must-be-assigned restriction, mirroring
-- migration 0017's `tasks_insert`/`job_status_history_insert` pattern
-- exactly.
ALTER TABLE "inventory"."job_parts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "inventory"."job_parts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY job_parts_select ON "inventory"."job_parts"
  FOR SELECT TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'inventory', 'read')
    OR (
      app.current_user_has_permission(organization_id, 'inventory', 'consume')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = job_parts.job_id AND ja.user_id = (select auth.uid())
      )
    )
  );
--> statement-breakpoint
CREATE POLICY job_parts_insert ON "inventory"."job_parts"
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      app.current_user_has_permission(organization_id, 'inventory', 'write')
      OR (
        app.current_user_has_permission(organization_id, 'inventory', 'consume')
        AND EXISTS (
          SELECT 1 FROM jobs.job_assignments ja
          WHERE ja.job_id = job_parts.job_id AND ja.user_id = (select auth.uid())
        )
      )
    )
    AND EXISTS (
      SELECT 1 FROM jobs.jobs j
      WHERE j.id = job_parts.job_id AND j.organization_id = job_parts.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM inventory.inventory_items ii
      WHERE ii.id = job_parts.inventory_item_id AND ii.organization_id = job_parts.organization_id
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_job_parts
  AFTER INSERT ON "inventory"."job_parts"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- inventory.suppliers: same shape as inventory_items.
ALTER TABLE "inventory"."suppliers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "inventory"."suppliers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY suppliers_select ON "inventory"."suppliers"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'inventory', 'read'));
--> statement-breakpoint
CREATE POLICY suppliers_insert ON "inventory"."suppliers"
  FOR INSERT TO authenticated
  WITH CHECK (app.current_user_has_permission(organization_id, 'inventory', 'write'));
--> statement-breakpoint
CREATE POLICY suppliers_update ON "inventory"."suppliers"
  FOR UPDATE TO authenticated
  USING (app.current_user_has_permission(organization_id, 'inventory', 'write'))
  WITH CHECK (app.current_user_has_permission(organization_id, 'inventory', 'write'));
--> statement-breakpoint
CREATE TRIGGER audit_suppliers
  AFTER INSERT OR UPDATE OR DELETE ON "inventory"."suppliers"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- inventory.purchase_orders: WITH CHECK verifies supplier_id and
-- receiving_location_id belong to the claimed organization_id —
-- "Tenant A cannot order against Tenant B's Supplier/Location."
ALTER TABLE "inventory"."purchase_orders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "inventory"."purchase_orders" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY purchase_orders_select ON "inventory"."purchase_orders"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'inventory', 'read'));
--> statement-breakpoint
CREATE POLICY purchase_orders_insert ON "inventory"."purchase_orders"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'inventory', 'write')
    AND EXISTS (
      SELECT 1 FROM inventory.suppliers s
      WHERE s.id = purchase_orders.supplier_id AND s.organization_id = purchase_orders.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM inventory.inventory_locations il
      WHERE il.id = purchase_orders.receiving_location_id AND il.organization_id = purchase_orders.organization_id
    )
  );
--> statement-breakpoint
CREATE POLICY purchase_orders_update ON "inventory"."purchase_orders"
  FOR UPDATE TO authenticated
  USING (app.current_user_has_permission(organization_id, 'inventory', 'write'))
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'inventory', 'write')
    AND EXISTS (
      SELECT 1 FROM inventory.suppliers s
      WHERE s.id = purchase_orders.supplier_id AND s.organization_id = purchase_orders.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM inventory.inventory_locations il
      WHERE il.id = purchase_orders.receiving_location_id AND il.organization_id = purchase_orders.organization_id
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_purchase_orders
  AFTER INSERT OR UPDATE OR DELETE ON "inventory"."purchase_orders"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- inventory.purchase_order_line_items: WITH CHECK verifies
-- purchase_order_id and inventory_item_id belong to the claimed
-- organization_id.
ALTER TABLE "inventory"."purchase_order_line_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "inventory"."purchase_order_line_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY purchase_order_line_items_select ON "inventory"."purchase_order_line_items"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'inventory', 'read'));
--> statement-breakpoint
CREATE POLICY purchase_order_line_items_insert ON "inventory"."purchase_order_line_items"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'inventory', 'write')
    AND EXISTS (
      SELECT 1 FROM inventory.purchase_orders po
      WHERE po.id = purchase_order_line_items.purchase_order_id
        AND po.organization_id = purchase_order_line_items.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM inventory.inventory_items ii
      WHERE ii.id = purchase_order_line_items.inventory_item_id
        AND ii.organization_id = purchase_order_line_items.organization_id
    )
  );
--> statement-breakpoint
CREATE POLICY purchase_order_line_items_update ON "inventory"."purchase_order_line_items"
  FOR UPDATE TO authenticated
  USING (app.current_user_has_permission(organization_id, 'inventory', 'write'))
  WITH CHECK (app.current_user_has_permission(organization_id, 'inventory', 'write'));
--> statement-breakpoint
CREATE TRIGGER audit_purchase_order_line_items
  AFTER INSERT OR UPDATE OR DELETE ON "inventory"."purchase_order_line_items"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
