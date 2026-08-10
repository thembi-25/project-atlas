import { InvalidStockMovementError } from './errors';

export type StockMovementReason = 'received' | 'consumed_on_job' | 'transferred' | 'adjusted';

/**
 * inventory.md business rule 1: "Quantity on hand per location is always
 * derived by summing `stock_movements`." The infrastructure layer
 * performs this as a live SQL `SUM`; this pure function exists so the
 * derivation rule itself is unit-testable without a database.
 */
export function computeQuantityOnHand(quantityDeltas: readonly number[]): number {
  return quantityDeltas.reduce((sum, delta) => sum + delta, 0);
}

/**
 * inventory-prd.md §16: "adjusting stock with a non-numeric or
 * negative-for-a-`received`-type movement (422)." inventory.md Edge
 * Cases: an `adjusted` movement requires a `notes` reason (a physical
 * count reconciliation must explain itself, never silently reset the
 * quantity).
 */
export function validateStockMovementInput(input: {
  reason: StockMovementReason;
  quantityDelta: number;
  notes?: string | null | undefined;
}): void {
  if (!Number.isFinite(input.quantityDelta) || input.quantityDelta === 0) {
    throw new InvalidStockMovementError('quantityDelta must be a non-zero finite number.');
  }
  if (input.reason === 'received' && input.quantityDelta <= 0) {
    throw new InvalidStockMovementError('A "received" movement must have a positive quantity.');
  }
  if (input.reason === 'consumed_on_job' && input.quantityDelta >= 0) {
    throw new InvalidStockMovementError(
      'A "consumed_on_job" movement must have a negative quantity.',
    );
  }
  if (input.reason === 'adjusted' && !input.notes?.trim()) {
    throw new InvalidStockMovementError('An "adjusted" movement requires a reason in `notes`.');
  }
}

/**
 * inventory.md business rule 2: consuming more than is on hand is
 * allowed — the system warns but never hard-blocks. Returns a
 * human-readable warning string when the post-consumption quantity would
 * go negative, or `undefined` when stock is sufficient.
 */
export function checkSufficientStock(params: {
  quantityOnHand: number;
  quantityToConsume: number;
}): string | undefined {
  const resulting = params.quantityOnHand - params.quantityToConsume;
  if (resulting < 0) {
    return `Consuming ${params.quantityToConsume} would bring quantity on hand to ${resulting} (only ${params.quantityOnHand} available at this location). Proceeding anyway — reconcile with an "adjusted" movement later.`;
  }
  return undefined;
}
