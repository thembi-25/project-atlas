import { ForbiddenError, InvalidStockMovementError, NotFoundError } from '@atlas/inventory';
import {
  ForbiddenError as SuppliersForbiddenError,
  InvalidPurchaseOrderStateError,
  NotFoundError as SuppliersNotFoundError,
  PurchaseOrderReceiptError,
} from '@atlas/suppliers';
import { AppError } from './errors';

/**
 * Maps @atlas/inventory's and @atlas/suppliers's framework-agnostic
 * domain errors onto the documented API error catalog
 * (docs/05-api/errors.md) — mirrors apps/web/lib/financials-errors.ts's
 * pattern. Combined into one mapper since both packages share the
 * `inventory` Postgres schema and permission resource (see
 * docs/13-roadmap/sprint-6.md).
 */
export function mapInventoryError(error: unknown): AppError | undefined {
  if (error instanceof NotFoundError || error instanceof SuppliersNotFoundError) {
    return new AppError('not_found', error.message);
  }
  if (error instanceof ForbiddenError || error instanceof SuppliersForbiddenError) {
    return new AppError('forbidden', error.message);
  }
  if (error instanceof InvalidPurchaseOrderStateError) {
    return new AppError('conflict', error.message);
  }
  if (error instanceof InvalidStockMovementError || error instanceof PurchaseOrderReceiptError) {
    return new AppError('validation_error', error.message);
  }
  return undefined;
}
