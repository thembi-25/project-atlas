import type {
  DispatchEvent,
  ScheduleConflict,
  ScheduleEvent,
  ScheduleEventHistoryEntry,
} from '@atlas/scheduling';

export function serializeScheduleEvent(event: ScheduleEvent) {
  return {
    id: event.id,
    organization_id: event.organizationId,
    job_id: event.jobId,
    scheduled_start: event.scheduledStart.toISOString(),
    scheduled_end: event.scheduledEnd.toISOString(),
    team_id: event.teamId,
    notes: event.notes,
    created_at: event.createdAt.toISOString(),
    updated_at: event.updatedAt.toISOString(),
  };
}

export function serializeScheduleEventHistoryEntry(entry: ScheduleEventHistoryEntry) {
  return {
    id: entry.id,
    schedule_event_id: entry.scheduleEventId,
    job_id: entry.jobId,
    previous_start: entry.previousStart.toISOString(),
    previous_end: entry.previousEnd.toISOString(),
    reason: entry.reason,
    changed_by_user_id: entry.changedByUserId,
    created_at: entry.createdAt.toISOString(),
  };
}

export function serializeScheduleConflict(conflict: ScheduleConflict) {
  return {
    schedule_event_id: conflict.scheduleEventId,
    job_id: conflict.jobId,
    user_id: conflict.userId,
    scheduled_start: conflict.scheduledStart.toISOString(),
    scheduled_end: conflict.scheduledEnd.toISOString(),
  };
}

export function serializeDispatchEvent(event: DispatchEvent) {
  return {
    id: event.id,
    organization_id: event.organizationId,
    job_id: event.jobId,
    dispatched_at: event.dispatchedAt.toISOString(),
    dispatched_by_user_id: event.dispatchedByUserId,
    acknowledged_at: event.acknowledgedAt ? event.acknowledgedAt.toISOString() : null,
    en_route_at: event.enRouteAt ? event.enRouteAt.toISOString() : null,
    arrived_at: event.arrivedAt ? event.arrivedAt.toISOString() : null,
    created_at: event.createdAt.toISOString(),
    updated_at: event.updatedAt.toISOString(),
  };
}
