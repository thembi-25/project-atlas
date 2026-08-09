import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { findCustomerForOrganization, findContactForOrganization } from '@atlas/crm';
import { findPropertyById } from '@atlas/properties';
import { findAssetForOrganization } from '@atlas/assets';
import { NotFoundError } from '../domain/errors';
import { insertJob, type Job, type JobPriority, type JobSource } from '../infrastructure/jobs';
import { allocateJobNumber } from '../infrastructure/job-number';
import { insertJobStatusHistory } from '../infrastructure/job-status-history';
import { insertJobAsset } from '../infrastructure/job-assets';
import { findJobTypeById, jobTypeVisibleToOrganization } from '../infrastructure/job-types';
import {
  findServiceCategoryById,
  serviceCategoryVisibleToOrganization,
} from '../infrastructure/service-categories';
import {
  findChecklistTemplateForJobType,
  listChecklistTemplateItems,
} from '../infrastructure/checklist-templates';
import { insertTask } from '../infrastructure/tasks';
import { requireJobsPermission } from './authorize';

export interface CreateJobParams {
  organizationId: string;
  actorUserId: string;
  jobTypeId: string;
  serviceCategoryId?: string | undefined;
  priority?: JobPriority | undefined;
  customerId: string;
  propertyId: string;
  contactId?: string | undefined;
  description?: string | undefined;
  source?: JobSource | undefined;
  /** jobs.md relationships: "References zero or more Assets." */
  assetIds?: string[] | undefined;
}

export interface CreateJobResult {
  job: Job;
  taskCount: number;
}

/**
 * jobs.md business rule 1: a Job always has a `property_id`; business
 * rule 2: the Job Type's default checklist is copied onto the Job as
 * `tasks` at creation (tasks.md business rule 1 — a copy, not a live
 * reference). Every referenced Customer/Property/Contact/Asset is
 * verified to belong to the same Organization before the insert — the
 * "Tenant A cannot create a Job referencing Tenant B's Customer/
 * Property/Asset" guarantee, defense-in-depth alongside the database's
 * own RLS `WITH CHECK` (docs/07-security/tenant-isolation.md).
 */
export async function createJob(
  db: DatabaseClient,
  params: CreateJobParams,
): Promise<CreateJobResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireJobsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: 'write',
    });

    const jobType = await findJobTypeById(tx, params.jobTypeId);
    if (
      !jobType ||
      !jobTypeVisibleToOrganization(jobType, params.organizationId) ||
      !jobType.isActive
    ) {
      throw new NotFoundError('Job Type');
    }

    if (params.serviceCategoryId) {
      const category = await findServiceCategoryById(tx, params.serviceCategoryId);
      if (
        !category ||
        !serviceCategoryVisibleToOrganization(category, params.organizationId) ||
        !category.isActive
      ) {
        throw new NotFoundError('Service Category');
      }
    }

    const customer = await findCustomerForOrganization(tx, {
      organizationId: params.organizationId,
      customerId: params.customerId,
    });
    if (!customer) {
      throw new NotFoundError('Customer');
    }

    const property = await findPropertyById(tx, params.propertyId);
    if (!property || property.organizationId !== params.organizationId) {
      throw new NotFoundError('Property');
    }

    if (params.contactId) {
      const contact = await findContactForOrganization(tx, {
        organizationId: params.organizationId,
        contactId: params.contactId,
      });
      if (!contact) {
        throw new NotFoundError('Contact');
      }
    }

    const assetIds = params.assetIds ?? [];
    for (const assetId of assetIds) {
      const asset = await findAssetForOrganization(tx, {
        organizationId: params.organizationId,
        assetId,
      });
      if (!asset) {
        throw new NotFoundError('Asset');
      }
    }

    const jobNumber = await allocateJobNumber(tx, params.organizationId);

    const job = await insertJob(tx, {
      organizationId: params.organizationId,
      jobNumber,
      jobTypeId: params.jobTypeId,
      serviceCategoryId: params.serviceCategoryId,
      priority: params.priority,
      customerId: params.customerId,
      propertyId: params.propertyId,
      contactId: params.contactId,
      description: params.description,
      source: params.source,
    });

    await insertJobStatusHistory(tx, {
      organizationId: params.organizationId,
      jobId: job.id,
      fromStatus: null,
      toStatus: 'draft',
      changedByUserId: params.actorUserId,
    });

    for (const assetId of assetIds) {
      await insertJobAsset(tx, { organizationId: params.organizationId, jobId: job.id, assetId });
    }

    let taskCount = 0;
    const template = await findChecklistTemplateForJobType(tx, params.jobTypeId);
    if (template) {
      const items = await listChecklistTemplateItems(tx, template.id);
      for (const item of items) {
        await insertTask(tx, {
          organizationId: params.organizationId,
          jobId: job.id,
          checklistTemplateItemId: item.id,
          label: item.label,
          type: item.type,
          isRequired: item.isRequired,
          sortOrder: item.sortOrder,
        });
        taskCount += 1;
      }
    }

    return { job, taskCount };
  });
}
