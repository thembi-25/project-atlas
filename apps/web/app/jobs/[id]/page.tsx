'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button, Input, Label } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { JobDto, JobHistoryDto, TaskDto } from '@/lib/jobs-types';
import type {
  ScheduleConflictDto,
  ScheduleEventDto,
  DispatchEventDto,
} from '@/lib/scheduling-types';
import type { InventoryItemDto, InventoryLocationDto, JobPartDto } from '@/lib/inventory-types';

/**
 * Job detail page — jobs-prd.md §13: Property/Asset context, checklist,
 * scheduling, assignment, dispatch, and activity — jobs-prd.md/
 * scheduling-prd.md/dispatch-prd.md's documented sections only, plus
 * inventory-prd.md §13's "mobile 'add part' search/autocomplete on the
 * Job screen" (Sprint 6). No Estimate/Invoice section is rendered
 * (those live on their own Estimate/Invoice detail pages, not embedded
 * here) — see SPRINT-4-COMPLETION-REPORT.md, "Known Limitations".
 */
export default function JobDetailPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <JobDetailPageContent />
    </Suspense>
  );
}

const NEXT_ACTIONS: Record<string, { action: string; label: string }[]> = {
  dispatched: [{ action: 'start', label: 'Start work' }],
  in_progress: [
    { action: 'hold', label: 'Put on hold' },
    { action: 'complete', label: 'Complete' },
  ],
  on_hold: [{ action: 'resume', label: 'Resume' }],
};
const CANCELLABLE_STATUSES = new Set(['draft', 'scheduled', 'dispatched', 'on_hold']);

function JobDetailPageContent(): JSX.Element {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [job, setJob] = useState<JobDto | null>(null);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [history, setHistory] = useState<JobHistoryDto | null>(null);
  const [scheduleEvent, setScheduleEvent] = useState<ScheduleEventDto | null>(null);
  const [dispatchEvent, setDispatchEvent] = useState<DispatchEventDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setError(null);
    try {
      const qs = new URLSearchParams({ organization_id: organizationId });
      const [jobResult, tasksResult, historyResult] = await Promise.all([
        apiRequest<JobDto>(`/api/v1/jobs/${params.id}?${qs.toString()}`),
        apiRequest<TaskDto[]>(`/api/v1/jobs/${params.id}/tasks?${qs.toString()}`),
        apiRequest<JobHistoryDto>(`/api/v1/jobs/${params.id}/history?${qs.toString()}`),
      ]);
      setJob(jobResult.data);
      setTasks(tasksResult.data);
      setHistory(historyResult.data);

      try {
        const scheduleResult = await apiRequest<ScheduleEventDto>(
          `/api/v1/jobs/${params.id}/schedule?${qs.toString()}`,
        );
        setScheduleEvent(scheduleResult.data);
      } catch {
        setScheduleEvent(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Job.');
    }
  }, [organizationId, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (path: string, body?: Record<string, unknown>) => {
    if (!organizationId || !job) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await apiRequest<
        { job?: JobDto; dispatch_event?: DispatchEventDto } | DispatchEventDto
      >(path, {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId, ...body }),
      });
      const data = result.data as {
        job?: JobDto;
        dispatch_event?: DispatchEventDto;
      } & Partial<DispatchEventDto>;
      if (data.job) setJob(data.job);
      if (data.dispatch_event) setDispatchEvent(data.dispatch_event);
      if ('acknowledged_at' in data || 'en_route_at' in data || 'arrived_at' in data) {
        setDispatchEvent(data as DispatchEventDto);
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!organizationId) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="text-muted-foreground text-sm">
          Add <code className="bg-muted rounded px-1 py-0.5">?organization_id=&lt;id&gt;</code> to
          the URL to view this Job.
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="text-sm text-red-600">{error}</p>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </main>
    );
  }

  const nextActions = NEXT_ACTIONS[job.status] ?? [];

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Job #{job.job_number}</h1>
          <p className="text-muted-foreground text-sm">
            {job.status} · {job.priority}
          </p>
        </div>
      </div>

      {actionError ? <p className="mb-4 text-sm text-red-600">{actionError}</p> : null}

      <section className="border-border mb-6 rounded-md border p-4">
        <h2 className="mb-3 text-lg font-medium">Overview</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Customer</dt>
          <dd>{job.customer_id}</dd>
          <dt className="text-muted-foreground">Property</dt>
          <dd>{job.property_id}</dd>
          <dt className="text-muted-foreground">Description</dt>
          <dd>{job.description ?? '—'}</dd>
          {job.cancellation_reason ? (
            <>
              <dt className="text-muted-foreground">Cancellation reason</dt>
              <dd>{job.cancellation_reason}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="border-border mb-6 rounded-md border p-4">
        <h2 className="mb-3 text-lg font-medium">Lifecycle</h2>
        <div className="flex flex-wrap gap-2">
          {nextActions.map((a) => (
            <Button
              key={a.action}
              disabled={busy}
              onClick={() => void runAction(`/api/v1/jobs/${job.id}/${a.action}`)}
            >
              {a.label}
            </Button>
          ))}
          {CANCELLABLE_STATUSES.has(job.status) ? (
            <CancelJobButton
              busy={busy}
              onCancel={(reason) => runAction(`/api/v1/jobs/${job.id}/cancel`, { reason })}
            />
          ) : null}
        </div>
      </section>

      <section className="border-border mb-6 rounded-md border p-4">
        <h2 className="mb-3 text-lg font-medium">Checklist</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-3">
              <span>
                {task.label} {task.is_required ? <span className="text-red-600">*</span> : null}
              </span>
              {task.completed_at ? (
                <span className="text-muted-foreground text-xs">Done</span>
              ) : (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void runAction(`/api/v1/jobs/${job.id}/tasks/${task.id}/complete`, {
                      response_value: true,
                    })
                  }
                >
                  Mark done
                </Button>
              )}
            </li>
          ))}
          {tasks.length === 0 ? <li className="text-muted-foreground">No Tasks.</li> : null}
        </ul>
      </section>

      <PartsSection jobId={job.id} organizationId={organizationId} />

      <ScheduleSection
        jobId={job.id}
        organizationId={organizationId}
        status={job.status}
        scheduleEvent={scheduleEvent}
        onScheduled={() => void load()}
      />

      <DispatchSection
        status={job.status}
        dispatchEvent={dispatchEvent}
        busy={busy}
        onDispatch={() => void runAction(`/api/v1/jobs/${job.id}/dispatch`)}
        onAcknowledge={() => void runAction(`/api/v1/jobs/${job.id}/acknowledge`)}
        onEnRoute={() => void runAction(`/api/v1/jobs/${job.id}/en-route`)}
        onArrived={() => void runAction(`/api/v1/jobs/${job.id}/arrived`)}
      />

      <section className="border-border rounded-md border p-4">
        <h2 className="mb-3 text-lg font-medium">Activity</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {history?.status_history.map((entry) => (
            <li key={entry.id} className="text-muted-foreground">
              {entry.from_status
                ? `${entry.from_status} → ${entry.to_status}`
                : `Created (${entry.to_status})`}
              {entry.reason ? ` — ${entry.reason}` : ''} ·{' '}
              {new Date(entry.created_at).toLocaleString()}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-3 text-xs">
          Job history will appear here once the Estimates/Invoices modules are implemented.
        </p>
      </section>
    </main>
  );
}

function CancelJobButton({
  busy,
  onCancel,
}: {
  busy: boolean;
  onCancel: (reason: string) => void;
}): JSX.Element {
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="outline" disabled={busy} onClick={() => setOpen(true)}>
        Cancel Job
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder="Cancellation reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <Button
        variant="outline"
        disabled={busy || !reason}
        onClick={() => {
          onCancel(reason);
          setOpen(false);
        }}
      >
        Confirm cancel
      </Button>
    </div>
  );
}

function ScheduleSection({
  jobId,
  organizationId,
  status,
  scheduleEvent,
  onScheduled,
}: {
  jobId: string;
  organizationId: string;
  status: string;
  scheduleEvent: ScheduleEventDto | null;
  onScheduled: () => void;
}): JSX.Element {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [userIds, setUserIds] = useState('');
  const [reason, setReason] = useState('');
  const [conflicts, setConflicts] = useState<ScheduleConflictDto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSchedule = status === 'draft' && !scheduleEvent;
  const canReschedule = Boolean(scheduleEvent) && status !== 'completed' && status !== 'cancelled';

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        organization_id: organizationId,
        scheduled_start: new Date(start).toISOString(),
        scheduled_end: new Date(end).toISOString(),
        user_ids: userIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        ...(canReschedule ? { reason: reason || undefined } : {}),
      };
      const result = await apiRequest<{
        schedule_event: ScheduleEventDto;
        conflicts: ScheduleConflictDto[];
      }>(`/api/v1/jobs/${jobId}/schedule`, {
        method: canReschedule ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      setConflicts(result.data.conflicts);
      onScheduled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule Job.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="border-border mb-6 rounded-md border p-4">
      <h2 className="mb-3 text-lg font-medium">Schedule</h2>
      {scheduleEvent ? (
        <p className="mb-3 text-sm">
          {new Date(scheduleEvent.scheduled_start).toLocaleString()} –{' '}
          {new Date(scheduleEvent.scheduled_end).toLocaleString()}
        </p>
      ) : (
        <p className="text-muted-foreground mb-3 text-sm">Not yet scheduled.</p>
      )}
      {canSchedule || canReschedule ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div>
              <Label htmlFor="scheduled_start">Start</Label>
              <Input
                id="scheduled_start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="scheduled_end">End</Label>
              <Input
                id="scheduled_end"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="user_ids">Technician user IDs (comma-separated)</Label>
            <Input id="user_ids" value={userIds} onChange={(e) => setUserIds(e.target.value)} />
          </div>
          {canReschedule ? (
            <div>
              <Label htmlFor="reschedule_reason">
                Reschedule reason (required once dispatched)
              </Label>
              <Input
                id="reschedule_reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {conflicts.length > 0 ? (
            <p className="text-sm text-amber-600">
              Warning: {conflicts.length} scheduling conflict(s) detected for the selected
              Technician(s) — you may still proceed.
            </p>
          ) : null}
          <div>
            <Button disabled={submitting || !start || !end} onClick={() => void submit()}>
              {submitting ? 'Saving…' : canReschedule ? 'Reschedule' : 'Schedule'}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DispatchSection({
  status,
  dispatchEvent,
  busy,
  onDispatch,
  onAcknowledge,
  onEnRoute,
  onArrived,
}: {
  status: string;
  dispatchEvent: DispatchEventDto | null;
  busy: boolean;
  onDispatch: () => void;
  onAcknowledge: () => void;
  onEnRoute: () => void;
  onArrived: () => void;
}): JSX.Element {
  return (
    <section className="border-border mb-6 rounded-md border p-4">
      <h2 className="mb-3 text-lg font-medium">Dispatch</h2>
      {status === 'scheduled' ? (
        <Button disabled={busy} onClick={onDispatch}>
          Dispatch
        </Button>
      ) : null}
      {dispatchEvent ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Dispatched</dt>
          <dd>{new Date(dispatchEvent.dispatched_at).toLocaleString()}</dd>
          <dt className="text-muted-foreground">Acknowledged</dt>
          <dd>
            {dispatchEvent.acknowledged_at
              ? new Date(dispatchEvent.acknowledged_at).toLocaleString()
              : '—'}
          </dd>
          <dt className="text-muted-foreground">En route</dt>
          <dd>
            {dispatchEvent.en_route_at ? new Date(dispatchEvent.en_route_at).toLocaleString() : '—'}
          </dd>
          <dt className="text-muted-foreground">Arrived</dt>
          <dd>
            {dispatchEvent.arrived_at ? new Date(dispatchEvent.arrived_at).toLocaleString() : '—'}
          </dd>
        </dl>
      ) : null}
      {status === 'dispatched' ? (
        <div className="mt-3 flex gap-2">
          <Button variant="outline" disabled={busy} onClick={onAcknowledge}>
            Acknowledge
          </Button>
          <Button variant="outline" disabled={busy} onClick={onEnRoute}>
            I&apos;m on my way
          </Button>
          <Button variant="outline" disabled={busy} onClick={onArrived}>
            Arrived
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/** inventory-prd.md §13: "mobile 'add part' search/autocomplete on the Job screen." Search here is a simple client-side filter over the Organization's Inventory Items — sufficient at this scale without a dedicated search endpoint. */
function PartsSection({
  jobId,
  organizationId,
}: {
  jobId: string;
  organizationId: string | null;
}): JSX.Element {
  const [parts, setParts] = useState<JobPartDto[]>([]);
  const [items, setItems] = useState<InventoryItemDto[]>([]);
  const [locations, setLocations] = useState<InventoryLocationDto[]>([]);
  const [query, setQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    try {
      const qs = `organization_id=${organizationId}`;
      const [partsResult, itemsResult, locationsResult] = await Promise.all([
        apiRequest<JobPartDto[]>(`/api/v1/jobs/${jobId}/parts?${qs}`),
        apiRequest<InventoryItemDto[]>(`/api/v1/inventory-items?${qs}&limit=100`),
        apiRequest<InventoryLocationDto[]>(`/api/v1/inventory-locations?${qs}`),
      ]);
      setParts(partsResult.data);
      setItems(itemsResult.data);
      setLocations(locationsResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Parts.');
    }
  }, [jobId, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!organizationId) return <></>;

  const itemById = new Map(items.map((i) => [i.id, i]));
  const matches = query
    ? items.filter(
        (item) =>
          item.sku.toLowerCase().includes(query.toLowerCase()) ||
          item.description.toLowerCase().includes(query.toLowerCase()),
      )
    : items;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setWarning(null);
    try {
      const result = await apiRequest<JobPartDto>(`/api/v1/jobs/${jobId}/parts`, {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          inventory_item_id: selectedItemId,
          location_id: locationId,
          quantity: Number(quantity),
        }),
      });
      if (result.data.warning) setWarning(result.data.warning);
      setSelectedItemId('');
      setQuery('');
      setQuantity('1');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add Part.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="border-border mb-6 rounded-md border p-4">
      <h2 className="mb-3 text-lg font-medium">Parts Used</h2>
      <ul className="mb-4 flex flex-col gap-1 text-sm">
        {parts.map((part) => (
          <li key={part.id}>
            {itemById.get(part.inventory_item_id)?.sku ?? part.inventory_item_id} × {part.quantity}{' '}
            (${part.unit_cost_at_time} ea.)
          </li>
        ))}
        {parts.length === 0 ? <li className="text-muted-foreground">No Parts used yet.</li> : null}
      </ul>

      <form onSubmit={submit} className="flex flex-col gap-2">
        <div>
          <Label htmlFor="part_search">Search parts</Label>
          <Input
            id="part_search"
            placeholder="Search by SKU or description…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedItemId('');
            }}
          />
          {query && !selectedItemId ? (
            <ul className="border-border mt-1 max-h-40 overflow-auto rounded-md border text-sm">
              {matches.map((item) => (
                <li
                  key={item.id}
                  className="hover:bg-muted cursor-pointer px-2 py-1"
                  onClick={() => {
                    setSelectedItemId(item.id);
                    setQuery(`${item.sku} — ${item.description}`);
                  }}
                >
                  {item.sku} — {item.description}
                </li>
              ))}
              {matches.length === 0 ? (
                <li className="text-muted-foreground px-2 py-1">No matches.</li>
              ) : null}
            </ul>
          ) : null}
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="part_location">Location</Label>
            <select
              id="part_location"
              required
              className="border-border w-full rounded-md border px-3 py-2 text-sm"
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
            >
              <option value="">Select a location…</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <Label htmlFor="part_quantity">Qty</Label>
            <Input
              id="part_quantity"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
        </div>
        {warning ? <p className="text-sm text-amber-700">{warning}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div>
          <Button type="submit" disabled={submitting || !selectedItemId}>
            {submitting ? 'Adding…' : 'Add Part'}
          </Button>
        </div>
      </form>
    </section>
  );
}
