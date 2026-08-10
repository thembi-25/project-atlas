import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { findJobById } from '@atlas/jobs';
import { NotFoundError } from '../domain/errors';
import { checkSufficientStock, validateStockMovementInput } from '../domain/stock';
import { findInventoryItemById } from '../infrastructure/inventory-items';
import { findInventoryLocationById } from '../infrastructure/inventory-locations';
import { insertJobPart, type JobPart } from '../infrastructure/job-parts';
import { getQuantityOnHand, insertStockMovement } from '../infrastructure/stock-movements';
import { requireInventoryConsumeAccess } from './authorize';

/**
 * inventory.md business rule 2 / inventory-prd.md §7: consuming a part on
 * a Job creates a `consumed_on_job` Stock Movement at the Technician's
 * *selected* location (not assumed to be their default truck — inventory.md
 * Edge Cases) and a `job_parts` row capturing `unit_cost_at_time`
 * independently of the Item's current `unit_cost` (business rule 3).
 * Insufficient stock is a warning, never a hard block (business rule 2).
 */
export interface ConsumePartParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  inventoryItemId: string;
  locationId: string;
  quantity: string;
}

export interface ConsumePartResult {
  jobPart: JobPart;
  warning?: string | undefined;
}

export async function consumePart(
  db: DatabaseClient,
  params: ConsumePartParams,
): Promise<ConsumePartResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryConsumeAccess(tx, params);

    const job = await findJobById(tx, params.jobId);
    if (!job || job.organizationId !== params.organizationId) {
      throw new NotFoundError('Job');
    }
    const item = await findInventoryItemById(tx, params.inventoryItemId);
    if (!item || item.organizationId !== params.organizationId) {
      throw new NotFoundError('Inventory Item');
    }
    const location = await findInventoryLocationById(tx, params.locationId);
    if (!location || location.organizationId !== params.organizationId) {
      throw new NotFoundError('Inventory Location');
    }

    const quantity = Number(params.quantity);
    validateStockMovementInput({
      reason: 'consumed_on_job',
      quantityDelta: -quantity,
    });

    const quantityOnHand = await getQuantityOnHand(tx, {
      inventoryItemId: params.inventoryItemId,
      locationId: params.locationId,
    });
    const warning = checkSufficientStock({ quantityOnHand, quantityToConsume: quantity });

    const movement = await insertStockMovement(tx, {
      organizationId: params.organizationId,
      inventoryItemId: params.inventoryItemId,
      locationId: params.locationId,
      reason: 'consumed_on_job',
      quantityDelta: String(-quantity),
      createdByUserId: params.actorUserId,
    });
    const jobPart = await insertJobPart(tx, {
      organizationId: params.organizationId,
      jobId: params.jobId,
      inventoryItemId: params.inventoryItemId,
      stockMovementId: movement.id,
      quantity: params.quantity,
      unitCostAtTime: item.unitCost,
      consumedByUserId: params.actorUserId,
    });

    return { jobPart, warning };
  });
}
