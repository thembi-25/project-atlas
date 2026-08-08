-- UUID v7 (time-ordered) primary key generation — see
-- docs/04-database/primary-keys.md. No off-the-shelf Postgres extension for
-- v7 is documented; this is a standard, widely-used construction built on
-- pgcrypto's gen_random_bytes, laying a 48-bit millisecond timestamp into
-- the first 6 bytes and setting the version/variant bits per RFC 9562.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.uuid_generate_v7()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  unix_ts_ms bytea;
  uuid_bytes bytea;
BEGIN
  unix_ts_ms := substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3 FOR 6);
  uuid_bytes := unix_ts_ms || gen_random_bytes(10);
  uuid_bytes := set_byte(uuid_bytes, 6, (b'0111' || get_byte(uuid_bytes, 6)::bit(4))::bit(8)::int);
  uuid_bytes := set_byte(uuid_bytes, 8, (b'10' || get_byte(uuid_bytes, 8)::bit(6))::bit(8)::int);
  RETURN encode(uuid_bytes, 'hex')::uuid;
END
$$;
--> statement-breakpoint
CREATE SCHEMA "reference";
--> statement-breakpoint
CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE SCHEMA "org";
--> statement-breakpoint
CREATE SCHEMA "platform";
--> statement-breakpoint
CREATE TYPE "identity"."membership_status" AS ENUM('invited', 'active', 'suspended', 'removed');--> statement-breakpoint
CREATE TYPE "org"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'cancelled');--> statement-breakpoint
CREATE TYPE "platform"."audit_action" AS ENUM('create', 'update', 'delete', 'state_transition');--> statement-breakpoint
CREATE TYPE "platform"."audit_actor_type" AS ENUM('user', 'system', 'api_key');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reference"."trade_types" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity"."membership_roles" (
	"membership_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_roles_membership_id_role_id_pk" PRIMARY KEY("membership_id","role_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity"."organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"status" "identity"."membership_status" DEFAULT 'invited' NOT NULL,
	"job_title" text,
	"invited_email" text,
	"invited_by_user_id" uuid,
	"invited_at" timestamp with time zone,
	"invitation_token_hash" text,
	"invitation_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_organization_memberships_user_or_email" CHECK ("identity"."organization_memberships"."user_id" is not null or "identity"."organization_memberships"."invited_email" is not null)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity"."permissions" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity"."role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity"."roles" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"avatar_url" text,
	"default_locale" text DEFAULT 'en-US' NOT NULL,
	"notification_channel_preference" text DEFAULT 'email' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."organization_trade_types" (
	"organization_id" uuid NOT NULL,
	"trade_type_id" uuid NOT NULL,
	CONSTRAINT "organization_trade_types_organization_id_trade_type_id_pk" PRIMARY KEY("organization_id","trade_type_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."organizations" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"business_email" text,
	"business_phone" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"locale" text DEFAULT 'en-US' NOT NULL,
	"subscription_status" "org"."subscription_status" DEFAULT 'trialing' NOT NULL,
	"logo_url" text,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."team_members" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."teams" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform"."audit_events" (
	"id" uuid DEFAULT public.uuid_generate_v7() NOT NULL,
	"organization_id" uuid,
	"actor_user_id" uuid,
	"actor_type" "platform"."audit_actor_type" DEFAULT 'user' NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" "platform"."audit_action" NOT NULL,
	"diff" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" uuid,
	"ip_address" "inet",
	CONSTRAINT "audit_events_id_occurred_at_pk" PRIMARY KEY("id","occurred_at")
) PARTITION BY RANGE ("occurred_at");
--> statement-breakpoint
-- Partitioned by month per docs/04-database/audit-logging.md. Explicit
-- partitions are created for the current month and the following 11 months;
-- a DEFAULT partition catches anything outside that window so inserts never
-- fail while new partitions are pending. Automating future partition
-- creation (e.g. a scheduled job) is a Sprint 2+ operational concern, not
-- invented speculatively here — see docs/08-engineering/coding-standards.md
-- on avoiding premature tooling.
CREATE TABLE IF NOT EXISTS "platform"."audit_events_default" PARTITION OF "platform"."audit_events" DEFAULT;
--> statement-breakpoint
DO $$
DECLARE
  partition_start date := date_trunc('month', now());
  partition_end date;
  partition_name text;
  i int;
BEGIN
  FOR i IN 0..11 LOOP
    partition_end := partition_start + interval '1 month';
    partition_name := 'audit_events_' || to_char(partition_start, 'YYYY_MM');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.%I PARTITION OF %I.%I FOR VALUES FROM (%L) TO (%L);',
      'platform', partition_name, 'platform', 'audit_events', partition_start, partition_end
    );
    partition_start := partition_end;
  END LOOP;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."membership_roles" ADD CONSTRAINT "membership_roles_membership_id_organization_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "identity"."organization_memberships"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."membership_roles" ADD CONSTRAINT "membership_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "identity"."roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."organization_memberships" ADD CONSTRAINT "organization_memberships_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "identity"."roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "identity"."permissions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org"."organization_trade_types" ADD CONSTRAINT "organization_trade_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org"."organization_trade_types" ADD CONSTRAINT "organization_trade_types_trade_type_id_trade_types_id_fk" FOREIGN KEY ("trade_type_id") REFERENCES "reference"."trade_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org"."team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "org"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org"."team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org"."teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform"."audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "identity"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_trade_types_slug" ON "reference"."trade_types" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_organization_memberships_user_org" ON "identity"."organization_memberships" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_org_memberships_org_invited_email" ON "identity"."organization_memberships" USING btree ("organization_id","invited_email") WHERE "identity"."organization_memberships"."status" = 'invited';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organization_memberships_organization_id_status" ON "identity"."organization_memberships" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_permissions_resource_action" ON "identity"."permissions" USING btree ("resource","action");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_roles_name" ON "identity"."roles" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_email" ON "identity"."users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_teams_organization_id_name" ON "org"."teams" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_events_organization_id_occurred_at" ON "platform"."audit_events" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_events_entity_type_entity_id" ON "platform"."audit_events" USING btree ("entity_type","entity_id");