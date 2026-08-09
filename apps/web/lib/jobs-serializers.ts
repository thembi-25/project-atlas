import type {
  Job,
  JobAssignment,
  JobAsset,
  JobStatusHistoryEntry,
  JobType,
  ServiceCategory,
  Task,
} from '@atlas/jobs';

/** docs/05-api/resource-conventions.md: response JSON mirrors database column names (snake_case). */
export function serializeJob(job: Job) {
  return {
    id: job.id,
    organization_id: job.organizationId,
    job_number: job.jobNumber,
    job_type_id: job.jobTypeId,
    service_category_id: job.serviceCategoryId,
    status: job.status,
    priority: job.priority,
    customer_id: job.customerId,
    property_id: job.propertyId,
    contact_id: job.contactId,
    description: job.description,
    source: job.source,
    cancellation_reason: job.cancellationReason,
    deleted_at: job.deletedAt ? job.deletedAt.toISOString() : null,
    created_at: job.createdAt.toISOString(),
    updated_at: job.updatedAt.toISOString(),
  };
}

export function serializeTask(task: Task) {
  return {
    id: task.id,
    organization_id: task.organizationId,
    job_id: task.jobId,
    checklist_template_item_id: task.checklistTemplateItemId,
    label: task.label,
    type: task.type,
    is_required: task.isRequired,
    sort_order: task.sortOrder,
    response_value: task.responseValue,
    completed_by_user_id: task.completedByUserId,
    completed_at: task.completedAt ? task.completedAt.toISOString() : null,
    override_reason: task.overrideReason,
    created_at: task.createdAt.toISOString(),
    updated_at: task.updatedAt.toISOString(),
  };
}

export function serializeJobAssignment(assignment: JobAssignment) {
  return {
    id: assignment.id,
    organization_id: assignment.organizationId,
    job_id: assignment.jobId,
    user_id: assignment.userId,
    assigned_by_user_id: assignment.assignedByUserId,
    created_at: assignment.createdAt.toISOString(),
  };
}

export function serializeJobAsset(jobAsset: JobAsset) {
  return {
    id: jobAsset.id,
    organization_id: jobAsset.organizationId,
    job_id: jobAsset.jobId,
    asset_id: jobAsset.assetId,
    created_at: jobAsset.createdAt.toISOString(),
  };
}

export function serializeJobStatusHistoryEntry(entry: JobStatusHistoryEntry) {
  return {
    id: entry.id,
    job_id: entry.jobId,
    from_status: entry.fromStatus,
    to_status: entry.toStatus,
    reason: entry.reason,
    changed_by_user_id: entry.changedByUserId,
    created_at: entry.createdAt.toISOString(),
  };
}

export function serializeJobType(jobType: JobType) {
  return {
    id: jobType.id,
    organization_id: jobType.organizationId,
    trade_type_id: jobType.tradeTypeId,
    name: jobType.name,
    default_duration_minutes: jobType.defaultDurationMinutes,
    is_active: jobType.isActive,
  };
}

export function serializeServiceCategory(category: ServiceCategory) {
  return {
    id: category.id,
    organization_id: category.organizationId,
    name: category.name,
    is_active: category.isActive,
  };
}
