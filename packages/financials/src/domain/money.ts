/**
 * Money math — estimates.md/invoices.md: "total is always derived from
 * summing line items plus tax; it is never a manually entered field."
 *
 * All values are plain JS numbers rounded to the cent at every step
 * (never carrying sub-cent floating-point error forward), matching
 * `numeric(12,2)`'s two-decimal-place precision — see
 * docs/04-database/naming-conventions.md. `tax_total` itself has no
 * automatic tax-rate/jurisdiction computation in this sprint (no such
 * configuration entity is in scope per docs/06-modules/estimates-prd.md/
 * invoicing-prd.md); it is a value the caller supplies (defaulting to 0),
 * while `subtotal` and `total` are always computed here, never accepted
 * as independent input.
 */

export function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeLineTotal(quantity: number, unitPrice: number): number {
  return roundToCents(quantity * unitPrice);
}

export function computeSubtotal(lineTotals: number[]): number {
  return roundToCents(lineTotals.reduce((sum, value) => sum + value, 0));
}

export function computeTotal(subtotal: number, taxTotal: number): number {
  return roundToCents(subtotal + taxTotal);
}

/** payments.md: `amount_paid`/`balance_due` are always derived from linked, non-refunded Payments — never stored independently. */
export function computeAmountPaid(paymentAmounts: number[]): number {
  return roundToCents(paymentAmounts.reduce((sum, value) => sum + value, 0));
}

export function computeBalanceDue(total: number, amountPaid: number): number {
  return roundToCents(total - amountPaid);
}

/** Stripe amounts are in the smallest currency unit (cents for USD) — see @atlas/integrations. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number): number {
  return roundToCents(cents / 100);
}
