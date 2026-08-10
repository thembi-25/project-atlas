-- Estimates, Invoicing & Payments (Sprint 5): the payments.md business
-- rule 4 database-level guard — "the sum of non-failed Payments (including
-- negative refund records) against an Invoice can never cause amount_paid
-- to exceed the Invoice total ... enforced at the application layer at
-- capture time AND verified by a database check." This is a cross-row
-- invariant (a sum across sibling rows), which Postgres CHECK constraints
-- cannot express (they only see one row at a time) — see
-- financials.ts's comment on `payments` for why this couldn't be modeled
-- in Drizzle's schema builder, the same "logic Drizzle Kit cannot express"
-- precedent as `jobs.schedule_events`' overlap detection (migration 0017).
--
-- A BEFORE INSERT trigger (not AFTER, so the offending row never commits)
-- re-sums `status <> 'failed'` Payments for the target Invoice, including
-- the incoming row, and rejects it if the total would exceed the
-- Invoice's `total`. Only fires on INSERT: Payments are append-only
-- (payments.md), so `amount` is never updated on an existing row after
-- capture — only new rows (including refunds) ever introduce a new
-- amount into the sum.

CREATE OR REPLACE FUNCTION app.check_payment_amount_within_invoice_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice_total numeric(12, 2);
  v_existing_sum numeric(12, 2);
BEGIN
  SELECT total INTO v_invoice_total
  FROM financials.invoices
  WHERE id = NEW.invoice_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_existing_sum
  FROM financials.payments
  WHERE invoice_id = NEW.invoice_id
    AND status <> 'failed';

  IF (v_existing_sum + NEW.amount) > v_invoice_total THEN
    RAISE EXCEPTION
      'Payment amount % would bring total paid on invoice % to %, exceeding invoice total %',
      NEW.amount, NEW.invoice_id, (v_existing_sum + NEW.amount), v_invoice_total
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER check_payment_amount_within_invoice_total
  BEFORE INSERT ON "financials"."payments"
  FOR EACH ROW EXECUTE FUNCTION app.check_payment_amount_within_invoice_total();
