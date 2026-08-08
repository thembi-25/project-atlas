# Scheduling

## Purpose

Scheduling is the process of assigning a [Job](./jobs.md) to a specific time window and one or more [Technicians](./technicians.md). It is distinct from [Dispatch](./dispatch.md): Scheduling determines *when and who*; Dispatch is the *act of notifying and handing off* the scheduled Job to the Technician.

## Key attributes (via `schedule_events`)

- `job_id`, `scheduled_start`, `scheduled_end` (a time window, not a single instant — customers are typically given a window).
- `assigned_user_ids` (one or more Technicians; multi-Technician Jobs are supported).
- `team_id` (optional, for Team-based scheduling views).
- Reschedule history (previous windows, reason).

## Relationships

- **Belongs to** one [Job](./jobs.md) (a Job has at most one active `schedule_event`; rescheduling updates it and logs history rather than creating a competing record).
- **References** one or more [Users](./users.md) (Technicians) and optionally a [Team](./users.md#teams).

## Business rules

1. Scheduling a Job requires the Job to be in `draft` or `scheduled` status (see [Jobs](./jobs.md), State Machine) and transitions it to `scheduled`.
2. The system detects and warns on double-booking (a Technician assigned to overlapping time windows) but does not hard-block it — real-world dispatch sometimes requires deliberate overlap (a Technician starting one job while wrapping up another); the Dispatcher makes the final call, and the warning plus the eventual Job/Technician utilization reporting keep this visible rather than silently allowed.
3. Rescheduling a `dispatched` or `in_progress` Job requires an explicit reason and triggers re-notification to the Customer (see [Notifications PRD](../06-modules/notifications-prd.md)) — a schedule change is never silent to the customer.
4. Scheduling respects a Technician's declared availability pattern (`technician_profiles`) as a soft constraint (UI warning), not a hard block.

## Data requirements

`schedule_events` (`job_id`, `scheduled_start`, `scheduled_end`, `team_id`, timestamps), `schedule_event_assignments` (join to Users), `schedule_event_history` (reschedule log).

## API requirements

Endpoints for creating/updating a schedule event, a calendar/board read endpoint filterable by Technician/Team/date range, and a conflict-check endpoint. See [Scheduling PRD](../06-modules/scheduling-prd.md).

## Permission requirements

Dispatcher/Admin/Owner: full read/write. Technician: read-only on their own schedule.

## Related documents

[Scheduling PRD](../06-modules/scheduling-prd.md) · [Dispatch](./dispatch.md) · [Jobs](./jobs.md) · [Notifications PRD](../06-modules/notifications-prd.md)
