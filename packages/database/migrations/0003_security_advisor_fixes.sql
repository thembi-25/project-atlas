-- Fixes for findings reported by Supabase's security advisor immediately
-- after 0000-0002 were applied — see SPRINT-1-COMPLETION-REPORT.md,
-- "Security Verification."
--
-- 1. RLS-disabled (critical): the monthly audit_events partitions inherit
--    the parent's RLS policies for queries routed through the parent
--    (platform.audit_events, the only name the application ever uses —
--    see packages/database/src/schema/platform.ts), but Postgres does not
--    automatically enable RLS on partitions for queries that address a
--    partition directly by name. Enabling (and forcing) RLS on each
--    partition with no policy of its own makes direct partition access
--    default-deny, closing that path without changing any application-
--    visible behavior.
-- 2. function_search_path_mutable (warn): pin search_path on every
--    function this sprint introduced so unqualified-identifier resolution
--    can't be hijacked by a session-level search_path change. All bodies
--    already schema-qualify every reference, so this is a safe, no-behavior
--    -change hardening.

ALTER TABLE "platform"."audit_events_default" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_default" FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2026_08" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2026_08" FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2026_09" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2026_09" FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2026_10" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2026_10" FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2026_11" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2026_11" FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2026_12" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2026_12" FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2027_01" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2027_01" FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2027_02" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2027_02" FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2027_03" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2027_03" FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2027_04" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2027_04" FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2027_05" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2027_05" FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2027_06" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2027_06" FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2027_07" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform"."audit_events_2027_07" FORCE ROW LEVEL SECURITY;

ALTER FUNCTION public.uuid_generate_v7() SET search_path = '';
ALTER FUNCTION app.current_user_has_org_access(uuid) SET search_path = '';
ALTER FUNCTION app.current_user_has_role(uuid, text[]) SET search_path = '';
ALTER FUNCTION app.current_actor_user_id() SET search_path = '';
ALTER FUNCTION app.record_audit_event() SET search_path = '';
