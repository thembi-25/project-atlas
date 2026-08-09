-- Fixes a real, previously-latent regression from Sprint 1's own security
-- hardening (0003_security_advisor_fixes.sql): pinning
-- `SET search_path = ''` on public.uuid_generate_v7() also broke its own
-- internal, unqualified call to pgcrypto's gen_random_bytes() (installed
-- in the `extensions` schema per Sprint 1's SPRINT-1-COMPLETION-REPORT.md).
-- No migration between 0003 and this one happened to perform a real
-- INSERT relying on this function's DEFAULT (0007/0011's role_permissions
-- grants have no id column; 0009/0010 were pure DDL) — Sprint 3's
-- Asset Types seed (0013_properties_seed_asset_types.sql, attempted
-- before this fix existed) was the first, and it failed with
-- `function gen_random_bytes(integer) does not exist`, surfacing the bug.
-- This would have broken every real application-level INSERT relying on
-- this default (organizations, customers, contacts, properties, ...) —
-- see docs/13-roadmap/SPRINT-3-COMPLETION-REPORT.md, "Security Findings."
--
-- Fix: fully schema-qualify the internal call (extensions.gen_random_bytes)
-- rather than widening search_path back open, preserving 0003's original
-- hardening intent — the same pattern already used for
-- app.current_user_has_permission (packages/database/migrations/
-- 0006_crm_rls_search_and_audit.sql).
CREATE OR REPLACE FUNCTION public.uuid_generate_v7()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $$
DECLARE
  unix_ts_ms bytea;
  uuid_bytes bytea;
BEGIN
  unix_ts_ms := substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3 FOR 6);
  uuid_bytes := unix_ts_ms || extensions.gen_random_bytes(10);
  uuid_bytes := set_byte(uuid_bytes, 6, (b'0111' || get_byte(uuid_bytes, 6)::bit(4))::bit(8)::int);
  uuid_bytes := set_byte(uuid_bytes, 8, (b'10' || get_byte(uuid_bytes, 8)::bit(6))::bit(8)::int);
  RETURN encode(uuid_bytes, 'hex')::uuid;
END
$$;
