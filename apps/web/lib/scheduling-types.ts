/** Client-side mirror of apps/web/lib/scheduling-serializers.ts's JSON shape. */
export interface ScheduleEventDto {
  id: string;
  organization_id: string;
  job_id: string;
  scheduled_start: string;
  scheduled_end: string;
  team_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleConflictDto {
  schedule_event_id: string;
  job_id: string;
  user_id: string;
  scheduled_start: string;
  scheduled_end: string;
}

export interface DispatchEventDto {
  id: string;
  organization_id: string;
  job_id: string;
  dispatched_at: string;
  dispatched_by_user_id: string | null;
  acknowledged_at: string | null;
  en_route_at: string | null;
  arrived_at: string | null;
  created_at: string;
  updated_at: string;
}
