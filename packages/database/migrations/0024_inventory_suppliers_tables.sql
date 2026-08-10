-- Inventory & Suppliers (Sprint 6): schema. Note for anyone reconciling
-- this file against Supabase's live migration history
-- (mcp__Supabase__list_migrations): the history contains one extra,
-- harmless entry named "0024_inventory_suppliers" applied moments before
-- this one, whose SQL body was empty (an operator error — the apply call
-- was made with a placeholder query instead of this file's content).
-- It created no objects and caused no schema drift; this file's content
-- is what actually created every table/type/constraint below, applied
-- immediately after under the corrected name
-- "0024_inventory_suppliers_tables", which is this file's basename.

CREATE SCHEMA "inventory";
--> statement-breakpoint
CREATE TYPE "inventory"."inventory_location_type" AS ENUM('warehouse', 'truck');--> statement-breakpoint
CREATE TYPE "inventory"."purchase_order_status" AS ENUM('draft', 'ordered', 'received', 'cancelled');--> statement-breakpoint
CREATE TYPE "inventory"."stock_movement_reason" AS ENUM('received', 'consumed_on_job', 'transferred', 'adjusted');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory"."inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"description" text NOT NULL,
	"asset_type_id" uuid,
	"unit_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"default_sell_price" numeric(12, 2),
	"low_stock_threshold" numeric(12, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory"."inventory_locations" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "inventory"."inventory_location_type" NOT NULL,
	"name" text NOT NULL,
	"technician_user_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory"."job_parts" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"stock_movement_id" uuid,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_cost_at_time" numeric(12, 2) NOT NULL,
	"consumed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory"."purchase_order_line_items" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity_ordered" numeric(12, 2) NOT NULL,
	"quantity_received" numeric(12, 2) DEFAULT '0' NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory"."purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"receiving_location_id" uuid NOT NULL,
	"status" "inventory"."purchase_order_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"ordered_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory"."stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"reason" "inventory"."stock_movement_reason" NOT NULL,
	"quantity_delta" numeric(12, 2) NOT NULL,
	"notes" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory"."suppliers" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"account_number" text,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."inventory_items" ADD CONSTRAINT "inventory_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."inventory_items" ADD CONSTRAINT "inventory_items_asset_type_id_asset_types_id_fk" FOREIGN KEY ("asset_type_id") REFERENCES "properties"."asset_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."inventory_locations" ADD CONSTRAINT "inventory_locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."inventory_locations" ADD CONSTRAINT "inventory_locations_technician_user_id_users_id_fk" FOREIGN KEY ("technician_user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."job_parts" ADD CONSTRAINT "job_parts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."job_parts" ADD CONSTRAINT "job_parts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "jobs"."jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."job_parts" ADD CONSTRAINT "job_parts_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory"."inventory_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."job_parts" ADD CONSTRAINT "job_parts_stock_movement_id_stock_movements_id_fk" FOREIGN KEY ("stock_movement_id") REFERENCES "inventory"."stock_movements"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."job_parts" ADD CONSTRAINT "job_parts_consumed_by_user_id_users_id_fk" FOREIGN KEY ("consumed_by_user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."purchase_order_line_items" ADD CONSTRAINT "purchase_order_line_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."purchase_order_line_items" ADD CONSTRAINT "purchase_order_line_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "inventory"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."purchase_order_line_items" ADD CONSTRAINT "purchase_order_line_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory"."inventory_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "inventory"."suppliers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."purchase_orders" ADD CONSTRAINT "purchase_orders_receiving_location_id_inventory_locations_id_fk" FOREIGN KEY ("receiving_location_id") REFERENCES "inventory"."inventory_locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory"."inventory_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "inventory"."inventory_locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory"."suppliers" ADD CONSTRAINT "suppliers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_inventory_items_org_sku" ON "inventory"."inventory_items" USING btree ("organization_id","sku") WHERE "inventory"."inventory_items"."deleted_at" IS NULL;