import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { findContactByPortalUserAndCustomer } from '@atlas/crm';
import { NotFoundError } from '../domain/errors';
import { findEstimateById, type Estimate } from '../infrastructure/estimates';
import { approveEstimateInTx, rejectEstimateInTx } from './estimate-transitions';

/**
 * Customer Portal write path — runs under `withServiceContext`, per
 * migration 0021's header note: a Portal write is not given its own RLS
 * INSERT/UPDATE policy; instead this function independently verifies
 * (before touching anything) that `portalUserId` is genuinely linked to a
 * Contact belonging to the target Estimate's Customer, mirroring
 * `acceptInvitation`'s exact escape-hatch reasoning. A cross-tenant or
 * unlinked attempt gets `NotFoundError` (404), matching the codebase's
 * consistent "don't reveal existence" pattern for unauthorized access.
 */
export interface PortalEstimateActionParams {
  portalUserId: string;
  estimateId: string;
}

export async function approveEstimateAsPortalContact(
  db: DatabaseClient,
  params: PortalEstimateActionParams,
): Promise<Estimate> {
  return withServiceContext(db, async (tx) => {
    const estimate = await findEstimateById(tx, params.estimateId);
    if (!estimate) throw new NotFoundError('Estimate');

    const contact = await findContactByPortalUserAndCustomer(tx, {
      portalUserId: params.portalUserId,
      customerId: estimate.customerId,
    });
    if (!contact) throw new NotFoundError('Estimate');

    return approveEstimateInTx(tx, {
      organizationId: estimate.organizationId,
      estimateId: estimate.id,
      approvedByContactId: contact.id,
    });
  });
}

export interface RejectEstimateAsPortalContactParams extends PortalEstimateActionParams {
  reason?: string | undefined;
}

export async function rejectEstimateAsPortalContact(
  db: DatabaseClient,
  params: RejectEstimateAsPortalContactParams,
): Promise<Estimate> {
  return withServiceContext(db, async (tx) => {
    const estimate = await findEstimateById(tx, params.estimateId);
    if (!estimate) throw new NotFoundError('Estimate');

    const contact = await findContactByPortalUserAndCustomer(tx, {
      portalUserId: params.portalUserId,
      customerId: estimate.customerId,
    });
    if (!contact) throw new NotFoundError('Estimate');

    return rejectEstimateInTx(tx, {
      organizationId: estimate.organizationId,
      estimateId: estimate.id,
      reason: params.reason,
    });
  });
}
