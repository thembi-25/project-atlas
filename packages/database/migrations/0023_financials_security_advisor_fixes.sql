-- Estimates, Invoicing & Payments (Sprint 5): post-migration security
-- advisor fix (mcp__Supabase__get_advisors after migration 0022),
-- mirroring migrations 0014/0019's precedent.
--
-- `function_search_path_mutable`: `app.check_payment_amount_within_
-- invoice_total()` (migration 0022) was created without a pinned
-- `search_path`, which the advisor flags because an unqualified
-- reference inside a SECURITY DEFINER/trigger function could be hijacked
-- by a search_path set at session or role level. The function already
-- schema-qualifies every relation it touches (`financials.invoices`,
-- `financials.payments`), so this is a hardening fix, not a functional
-- change.

ALTER FUNCTION app.check_payment_amount_within_invoice_total() SET search_path = '';
