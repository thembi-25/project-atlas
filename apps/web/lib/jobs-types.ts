/** Client-side mirror of apps/web/lib/jobs-serializers.ts's JSON shape. */
export type JobStatus =
  'draft' | 'scheduled' | 'dispatched' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
export type JobPriority = 'normal' | 'urgent' | 'emergency';
export type JobSource = 'phone' | 'portal' | 'repeat_visit' | 'marketplace';

export interface JobDto {
  id: string;
  organization_id: string;
  job_number: number;
  job_type_id: string;
  service_category_id: string | null;
  status: JobStatus;
  priority: JobPriority;
  customer_id: string;
  property_id: string;
  contact_id: string | null;
  description: string | null;
  source: JobSource;
  cancellation_reason: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskType = 'checkbox' | 'text' | 'number' | 'photo' | 'signature' | 'select';

export interface TaskDto {
  id: string;
  organization_id: string;
  job_id: string;
  checklist_template_item_id: string | null;
  label: string;
  type: TaskType;
  is_required: boolean;
  sort_order: number;
  response_value: unknown;
  completed_by_user_id: string | null;
  completed_at: string | null;
  override_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobAssignmentDto {
  id: string;
  organization_id: string;
  job_id: string;
  user_id: string;
  assigned_by_user_id: string | null;
  created_at: string;
}

export interface JobAssetDto {
  id: string;
  organization_id: string;
  job_id: string;
  asset_id: string;
  created_at: string;
}

export interface JobStatusHistoryEntryDto {
  id: string;
  job_id: string;
  from_status: JobStatus | null;
  to_status: JobStatus;
  reason: string | null;
  changed_by_user_id: string | null;
  created_at: string;
}

export interface JobTypeDto {
  id: string;
  organization_id: string | null;
  trade_type_id: string | null;
  name: string;
  default_duration_minutes: number | null;
  is_active: boolean;
}

export interface ServiceCategoryDto {
  id: string;
  organization_id: string | null;
  name: string;
  is_active: boolean;
}

export interface JobHistoryDto {
  job: JobDto;
  status_history: JobStatusHistoryEntryDto[];
  tasks: TaskDto[];
  assignments: JobAssignmentDto[];
}
