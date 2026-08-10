-- Estimates, Invoicing & Payments (Sprint 5): indexes, RLS, and audit
-- triggers for financials.{estimate_number_counters, estimates,
-- estimate_line_items, invoice_number_counters, invoices,
-- invoice_line_items, credit_notes, payments}, plus platform.domain_events,
-- platform.stripe_webhook_events, and the Customer Portal's Contact-scoped
-- read policies on crm.contacts/crm.customers. See
-- docs/04-database/indexes.md, docs/04-database/multi-tenancy.md,
-- docs/07-security/tenant-isolation.md, docs/04-database/audit-logging.md,
-- docs/06-modules/customer-portal-prd.md, docs/13-roadmap/sprint-5.md.
--
-- No `search_vector` column is added to any financials table: neither
-- estimates-prd.md nor invoicing-prd.md documents a full-text search
-- requirement for Estimates/Invoices (unlike Jobs/Customers/Properties),
-- so none is built — see docs/08-engineering, avoid unjustified scope.
--
-- Portal (Contact) access model, applied uniformly across every table
-- below: Contacts get read-only (`SELECT`) RLS policies scoped through
-- `crm.contacts.portal_user_id = (select auth.uid())`, mirroring the
-- staff `_select` policies as an additional, independent, OR'd policy —
-- Postgres evaluates multiple policies for the same command with OR
-- semantics, so this is purely additive. Portal *writes* (redeeming a
-- magic link and linking `portal_user_id`; approving/rejecting an
-- Estimate; capturing a Payment) are deliberately NOT given their own RLS
-- INSERT/UPDATE policies here — they run through `withServiceContext`
-- with an explicit, hand-written pre-check that the authenticated
-- Contact is genuinely linked to the target Customer, mirroring exactly
-- how `acceptInvitation` (Sprint 1) uses the same escape hatch for "a
-- write the actor has no ordinary standing RLS grant for yet." This
-- keeps the writable RLS surface reserved for staff (Membership-based)
-- policies only, per docs/06-modules/customer-portal-prd.md's requirement
-- that Portal access be explicit and narrowly scoped, and is implemented
-- in `@atlas/financials`'s portal application-layer functions (see
-- docs/13-roadmap/sprint-5.md, Deliverable 5).
--
-- `financials.estimate_number_counters`/`invoice_number_counters`: same
-- "RLS enabled/forced, zero policies" pattern as `jobs.job_number_counters`
-- (migration 0017) — internal counters, never client-readable/writable
-- directly, only touched by @atlas/financials's numbering allocators
-- inside the same request-context transaction as the owning INSERT/
-- finalize UPDATE.
--
-- `platform.stripe_webhook_events`: same zero-policy pattern — persisted
-- and processed exclusively by the webhook route handler and Worker, both
-- under `withServiceContext`, per docs/05-api/webhooks.md's mandated
-- pattern. No `authenticated`-role session (staff or Portal) ever reads
-- raw Stripe payloads directly.

-- Indexes — FK-covering indexes added proactively this sprint (rather
-- than deferred to a post-hoc security-advisor-fix migration, as in
-- Sprints 3-4) now that the `unindexed_foreign_keys` finding is a known,
-- expected category for every new FK.
CREATE INDEX "idx_estimates_job_id" ON "financials"."estimates" ("job_id");
--> statement-breakpoint
CREATE INDEX "idx_estimates_customer_id" ON "financials"."estimates" ("customer_id");
--> statement-breakpoint
CREATE INDEX "idx_estimates_contact_id" ON "financials"."estimates" ("contact_id");
--> statement-breakpoint
CREATE INDEX "idx_estimates_approved_by_contact_id" ON "financials"."estimates" ("approved_by_contact_id");
--> statement-breakpoint
CREATE INDEX "idx_estimates_approved_by_user_id" ON "financials"."estimates" ("approved_by_user_id");
--> statement-breakpoint
CREATE INDEX "idx_estimates_supersedes_estimate_id" ON "financials"."estimates" ("supersedes_estimate_id");
--> statement-breakpoint
CREATE INDEX "idx_estimates_organization_id_status" ON "financials"."estimates" ("organization_id", "status");
--> statement-breakpoint
CREATE INDEX "idx_estimate_line_items_organization_id" ON "financials"."estimate_line_items" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_estimate_line_items_estimate_id" ON "financials"."estimate_line_items" ("estimate_id");
--> statement-breakpoint
CREATE INDEX "idx_invoices_job_id" ON "financials"."invoices" ("job_id");
--> statement-breakpoint
CREATE INDEX "idx_invoices_estimate_id" ON "financials"."invoices" ("estimate_id");
--> statement-breakpoint
CREATE INDEX "idx_invoices_customer_id" ON "financials"."invoices" ("customer_id");
--> statement-breakpoint
CREATE INDEX "idx_invoices_organization_id_status" ON "financials"."invoices" ("organization_id", "status");
--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_organization_id" ON "financials"."invoice_line_items" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_invoice_id" ON "financials"."invoice_line_items" ("invoice_id");
--> statement-breakpoint
CREATE INDEX "idx_credit_notes_organization_id" ON "financials"."credit_notes" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_credit_notes_invoice_id" ON "financials"."credit_notes" ("invoice_id");
--> statement-breakpoint
CREATE INDEX "idx_credit_notes_issued_by_user_id" ON "financials"."credit_notes" ("issued_by_user_id");
--> statement-breakpoint
CREATE INDEX "idx_payments_invoice_id" ON "financials"."payments" ("invoice_id");
--> statement-breakpoint
CREATE INDEX "idx_payments_captured_by_user_id" ON "financials"."payments" ("captured_by_user_id");
--> statement-breakpoint
CREATE INDEX "idx_payments_refund_of_payment_id" ON "financials"."payments" ("refund_of_payment_id");
--> statement-breakpoint
CREATE INDEX "idx_payments_processor_reference_id" ON "financials"."payments" ("processor_reference_id");
--> statement-breakpoint
CREATE INDEX "idx_contacts_portal_user_id" ON "crm"."contacts" ("portal_user_id");
--> statement-breakpoint

-- financials.estimate_number_counters: internal-only, see header note.
ALTER TABLE "financials"."estimate_number_counters" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "financials"."estimate_number_counters" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- financials.invoice_number_counters: internal-only, see header note.
ALTER TABLE "financials"."invoice_number_counters" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "financials"."invoice_number_counters" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- financials.estimates: WITH CHECK verifies the referenced Job, Customer,
-- and (if present) Contact all belong to the claimed organization_id —
-- "Tenant A cannot create an Estimate against Tenant B's Job/Customer."
-- Portal SELECT is scoped through `crm.contacts` on `customer_id`, not
-- `organization_id` — a Contact's boundary is the Customer they belong
-- to, per docs/06-modules/customer-portal-prd.md.
ALTER TABLE "financials"."estimates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "financials"."estimates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY estimates_select ON "financials"."estimates"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'estimates', 'read'));
--> statement-breakpoint
CREATE POLICY estimates_portal_select ON "financials"."estimates"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm.contacts c
      WHERE c.customer_id = estimates.customer_id
        AND c.portal_user_id = (select auth.uid())
        AND c.portal_access_enabled = true
        AND c.deleted_at IS NULL
    )
  );
--> statement-breakpoint
CREATE POLICY estimates_insert ON "financials"."estimates"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'estimates', 'write')
    AND EXISTS (
      SELECT 1 FROM jobs.jobs j
      WHERE j.id = estimates.job_id AND j.organization_id = estimates.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM crm.customers c
      WHERE c.id = estimates.customer_id AND c.organization_id = estimates.organization_id
    )
    AND (
      estimates.contact_id IS NULL
      OR EXISTS (
        SELECT 1 FROM crm.contacts ct
        WHERE ct.id = estimates.contact_id AND ct.organization_id = estimates.organization_id
      )
    )
  );
--> statement-breakpoint
-- UPDATE covers every staff-driven transition (edit draft, send, record
-- approval/rejection on the Customer's behalf, convert, cancel) — the
-- specific action allowed is enforced by which Permission
-- (`estimates:write` for routine actions, `estimates:finalize` for
-- convert-to-Invoice, `estimates:void` for cancel — see
-- docs/13-roadmap/SPRINT-5-COMPLETION-REPORT.md, "Permissions") the
-- calling @atlas/financials function checks before issuing the UPDATE;
-- RLS is the outer tenant/permission boundary, not the state-machine
-- enforcer (same layering as @atlas/jobs's `transitionJobStatusInTx`).
CREATE POLICY estimates_update ON "financials"."estimates"
  FOR UPDATE TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'estimates', 'write')
    OR app.current_user_has_permission(organization_id, 'estimates', 'finalize')
    OR app.current_user_has_permission(organization_id, 'estimates', 'void')
  )
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'estimates', 'write')
    OR app.current_user_has_permission(organization_id, 'estimates', 'finalize')
    OR app.current_user_has_permission(organization_id, 'estimates', 'void')
  );
--> statement-breakpoint
CREATE TRIGGER audit_estimates
  AFTER INSERT OR UPDATE OR DELETE ON "financials"."estimates"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- financials.estimate_line_items: visibility/write scoped to the parent
-- Estimate. Immutability-once-sent (estimates.md business rule 2) is an
-- application-layer rule, not an RLS rule — same layering note as above.
ALTER TABLE "financials"."estimate_line_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "financials"."estimate_line_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY estimate_line_items_select ON "financials"."estimate_line_items"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'estimates', 'read'));
--> statement-breakpoint
CREATE POLICY estimate_line_items_portal_select ON "financials"."estimate_line_items"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM financials.estimates e
      JOIN crm.contacts c ON c.customer_id = e.customer_id
      WHERE e.id = estimate_line_items.estimate_id
        AND c.portal_user_id = (select auth.uid())
        AND c.portal_access_enabled = true
        AND c.deleted_at IS NULL
    )
  );
--> statement-breakpoint
CREATE POLICY estimate_line_items_write ON "financials"."estimate_line_items"
  FOR ALL TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'estimates', 'write')
    AND EXISTS (
      SELECT 1 FROM financials.estimates e
      WHERE e.id = estimate_line_items.estimate_id
        AND e.organization_id = estimate_line_items.organization_id
    )
  )
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'estimates', 'write')
    AND EXISTS (
      SELECT 1 FROM financials.estimates e
      WHERE e.id = estimate_line_items.estimate_id
        AND e.organization_id = estimate_line_items.organization_id
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_estimate_line_items
  AFTER INSERT OR UPDATE OR DELETE ON "financials"."estimate_line_items"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- financials.invoices: WITH CHECK verifies the referenced Job, Customer,
-- and (if present) Estimate all belong to the claimed organization_id.
-- No portal UPDATE policy: Invoices are never directly mutated by a
-- Contact — paying one means inserting a new `payments` row (via
-- service-context, see header note), never editing the Invoice itself,
-- which also correctly preserves invoices.md's immutability rule (an
-- Invoice literally cannot be touched by anyone lacking a staff
-- Permission, full stop).
ALTER TABLE "financials"."invoices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "financials"."invoices" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY invoices_select ON "financials"."invoices"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'invoices', 'read'));
--> statement-breakpoint
CREATE POLICY invoices_portal_select ON "financials"."invoices"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm.contacts c
      WHERE c.customer_id = invoices.customer_id
        AND c.portal_user_id = (select auth.uid())
        AND c.portal_access_enabled = true
        AND c.deleted_at IS NULL
    )
  );
--> statement-breakpoint
CREATE POLICY invoices_insert ON "financials"."invoices"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'invoices', 'write')
    AND EXISTS (
      SELECT 1 FROM jobs.jobs j
      WHERE j.id = invoices.job_id AND j.organization_id = invoices.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM crm.customers c
      WHERE c.id = invoices.customer_id AND c.organization_id = invoices.organization_id
    )
    AND (
      invoices.estimate_id IS NULL
      OR EXISTS (
        SELECT 1 FROM financials.estimates e
        WHERE e.id = invoices.estimate_id AND e.organization_id = invoices.organization_id
      )
    )
  );
--> statement-breakpoint
-- UPDATE covers draft edits (`invoices:write`), finalize
-- (`invoices:finalize`), and void (`invoices:void`) — same "RLS is the
-- outer boundary, the calling function picks the Permission" layering as
-- `estimates_update`.
CREATE POLICY invoices_update ON "financials"."invoices"
  FOR UPDATE TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'invoices', 'write')
    OR app.current_user_has_permission(organization_id, 'invoices', 'finalize')
    OR app.current_user_has_permission(organization_id, 'invoices', 'void')
  )
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'invoices', 'write')
    OR app.current_user_has_permission(organization_id, 'invoices', 'finalize')
    OR app.current_user_has_permission(organization_id, 'invoices', 'void')
  );
--> statement-breakpoint
CREATE TRIGGER audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON "financials"."invoices"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- financials.invoice_line_items: same shape as estimate_line_items.
ALTER TABLE "financials"."invoice_line_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "financials"."invoice_line_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY invoice_line_items_select ON "financials"."invoice_line_items"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'invoices', 'read'));
--> statement-breakpoint
CREATE POLICY invoice_line_items_portal_select ON "financials"."invoice_line_items"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM financials.invoices i
      JOIN crm.contacts c ON c.customer_id = i.customer_id
      WHERE i.id = invoice_line_items.invoice_id
        AND c.portal_user_id = (select auth.uid())
        AND c.portal_access_enabled = true
        AND c.deleted_at IS NULL
    )
  );
--> statement-breakpoint
CREATE POLICY invoice_line_items_write ON "financials"."invoice_line_items"
  FOR ALL TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'invoices', 'write')
    AND EXISTS (
      SELECT 1 FROM financials.invoices i
      WHERE i.id = invoice_line_items.invoice_id
        AND i.organization_id = invoice_line_items.organization_id
    )
  )
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'invoices', 'write')
    AND EXISTS (
      SELECT 1 FROM financials.invoices i
      WHERE i.id = invoice_line_items.invoice_id
        AND i.organization_id = invoice_line_items.organization_id
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_invoice_line_items
  AFTER INSERT OR UPDATE OR DELETE ON "financials"."invoice_line_items"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- financials.credit_notes: append-only (no UPDATE/DELETE policy — FORCE
-- RLS denies both outright). INSERT gated on `invoices:void` specifically
-- (not the broader `invoices:write`, which Technician also holds) —
-- invoices.md, "Permission requirements": "Accountant/Admin/Owner: full
-- access including void/credit note", i.e. issuing a Credit Note is the
-- same elevated tier as voiding, deliberately excluding Technician even
-- though Technician can create/write ordinary draft Invoices.
ALTER TABLE "financials"."credit_notes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "financials"."credit_notes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY credit_notes_select ON "financials"."credit_notes"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'invoices', 'read'));
--> statement-breakpoint
CREATE POLICY credit_notes_portal_select ON "financials"."credit_notes"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM financials.invoices i
      JOIN crm.contacts c ON c.customer_id = i.customer_id
      WHERE i.id = credit_notes.invoice_id
        AND c.portal_user_id = (select auth.uid())
        AND c.portal_access_enabled = true
        AND c.deleted_at IS NULL
    )
  );
--> statement-breakpoint
CREATE POLICY credit_notes_insert ON "financials"."credit_notes"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'invoices', 'void')
    AND EXISTS (
      SELECT 1 FROM financials.invoices i
      WHERE i.id = credit_notes.invoice_id AND i.organization_id = credit_notes.organization_id
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_credit_notes
  AFTER INSERT ON "financials"."credit_notes"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- financials.payments: append-only, including status transitions — no
-- UPDATE policy for `authenticated` at all (staff or Portal). A Payment's
-- pending -> completed/failed/refunded transition happens exclusively via
-- the Stripe webhook Worker handler under `withServiceContext`
-- (payments.md: "never trust the client's synchronous response... only
-- the webhook is authoritative" — see docs/13-roadmap/sprint-5.md,
-- "Scope decisions"). INSERT is staff-only (`payments:capture`) here;
-- Portal-initiated card-payment capture also runs under
-- `withServiceContext` (see header note) rather than through this INSERT
-- policy, so no separate portal INSERT policy exists.
ALTER TABLE "financials"."payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "financials"."payments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY payments_select ON "financials"."payments"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'payments', 'read'));
--> statement-breakpoint
CREATE POLICY payments_portal_select ON "financials"."payments"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM financials.invoices i
      JOIN crm.contacts c ON c.customer_id = i.customer_id
      WHERE i.id = payments.invoice_id
        AND c.portal_user_id = (select auth.uid())
        AND c.portal_access_enabled = true
        AND c.deleted_at IS NULL
    )
  );
--> statement-breakpoint
CREATE POLICY payments_insert ON "financials"."payments"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'payments', 'capture')
    AND EXISTS (
      SELECT 1 FROM financials.invoices i
      WHERE i.id = payments.invoice_id AND i.organization_id = payments.organization_id
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE ON "financials"."payments"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- platform.domain_events: written by producing modules (e.g.
-- @atlas/jobs's completeJob) inside the SAME request-context transaction
-- as their state change — unlike audit_events (system-trigger-only), this
-- table is inserted into directly by application code running as the
-- actor's own `authenticated` session, so it needs a real INSERT policy.
-- Scoped to "any active member of the org", not a specific resource
-- Permission: the event's correctness (type/payload) is the producing
-- module's own responsibility, not something RLS can meaningfully
-- second-guess, and the row is already tenant-pinned to the caller's own
-- organization_id (no cross-org write is possible). SELECT is reserved
-- for Owner/Admin, mirroring `audit_events_select`'s exact sensitivity
-- level. No UPDATE/DELETE policy: the outbox dispatcher (`apps/worker`)
-- marks rows dispatched under `withServiceContext`.
ALTER TABLE "platform"."domain_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "platform"."domain_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY domain_events_select ON "platform"."domain_events"
  FOR SELECT TO authenticated
  USING (app.current_user_has_role(organization_id, 'owner', 'admin'));
--> statement-breakpoint
CREATE POLICY domain_events_insert ON "platform"."domain_events"
  FOR INSERT TO authenticated
  WITH CHECK (app.current_user_has_org_access(organization_id));
--> statement-breakpoint

-- platform.stripe_webhook_events: zero policies — see header note.
ALTER TABLE "platform"."stripe_webhook_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "platform"."stripe_webhook_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- crm.contacts: adds the Portal's own-row SELECT policy, additive to
-- Sprint 2's staff `contacts_select` policy. A Contact can see their own
-- profile row once `portal_user_id` is linked; linking itself (first
-- magic-link verification) happens via `withServiceContext`, per header
-- note.
CREATE POLICY contacts_portal_select ON "crm"."contacts"
  FOR SELECT TO authenticated
  USING (
    portal_user_id = (select auth.uid())
    AND portal_access_enabled = true
    AND deleted_at IS NULL
  );
--> statement-breakpoint

-- crm.customers: adds the Portal's own-Customer SELECT policy, additive
-- to Sprint 2's staff `customers_select` policy — needed so the Portal UI
-- can render Customer context (name, billing address) alongside an
-- Estimate/Invoice without granting Jobs/Properties visibility.
CREATE POLICY customers_portal_select ON "crm"."customers"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm.contacts c
      WHERE c.customer_id = customers.id
        AND c.portal_user_id = (select auth.uid())
        AND c.portal_access_enabled = true
        AND c.deleted_at IS NULL
    )
  );
