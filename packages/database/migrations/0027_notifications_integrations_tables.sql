CREATE SCHEMA "notifications";
--> statement-breakpoint
CREATE SCHEMA "integrations";
--> statement-breakpoint
CREATE TYPE "notifications"."notification_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "notifications"."notification_owner_type" AS ENUM('user', 'contact');--> statement-breakpoint
CREATE TYPE "notifications"."notification_status" AS ENUM('queued', 'sent', 'delivered', 'bounced', 'failed');--> statement-breakpoint
CREATE TYPE "integrations"."integration_connection_status" AS ENUM('connected', 'disconnected');--> statement-breakpoint
CREATE TYPE "integrations"."integration_provider" AS ENUM('quickbooks');--> statement-breakpoint
CREATE TYPE "integrations"."sync_status" AS ENUM('pending', 'synced', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications"."notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_type" "notifications"."notification_owner_type" NOT NULL,
	"owner_user_id" uuid,
	"owner_contact_id" uuid,
	"event_type" text NOT NULL,
	"channel" "notifications"."notification_channel" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"recipient_type" "notifications"."notification_owner_type" NOT NULL,
	"recipient_user_id" uuid,
	"recipient_contact_id" uuid,
	"event_type" text NOT NULL,
	"channel" "notifications"."notification_channel" NOT NULL,
	"status" "notifications"."notification_status" DEFAULT 'queued' NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"provider_message_id" text,
	"error_detail" text,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integrations"."integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "integrations"."integration_provider" NOT NULL,
	"status" "integrations"."integration_connection_status" DEFAULT 'disconnected' NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"realm_id" text,
	"connected_by_user_id" uuid,
	"connected_at" timestamp with time zone,
	"disconnected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integrations"."sync_records" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "integrations"."integration_provider" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"status" "integrations"."sync_status" DEFAULT 'pending' NOT NULL,
	"external_id" text,
	"last_attempted_at" timestamp with time zone,
	"error_detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications"."notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications"."notification_preferences" ADD CONSTRAINT "notification_preferences_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications"."notification_preferences" ADD CONSTRAINT "notification_preferences_owner_contact_id_contacts_id_fk" FOREIGN KEY ("owner_contact_id") REFERENCES "crm"."contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications"."notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications"."notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications"."notifications" ADD CONSTRAINT "notifications_recipient_contact_id_contacts_id_fk" FOREIGN KEY ("recipient_contact_id") REFERENCES "crm"."contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."integration_connections" ADD CONSTRAINT "integration_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."integration_connections" ADD CONSTRAINT "integration_connections_connected_by_user_id_users_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."sync_records" ADD CONSTRAINT "sync_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_notification_preferences_user" ON "notifications"."notification_preferences" USING btree ("owner_user_id","event_type","channel") WHERE "notifications"."notification_preferences"."owner_type" = 'user';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_notification_preferences_contact" ON "notifications"."notification_preferences" USING btree ("owner_contact_id","event_type","channel") WHERE "notifications"."notification_preferences"."owner_type" = 'contact';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_sync_records_provider_entity" ON "integrations"."sync_records" USING btree ("provider","entity_type","entity_id");