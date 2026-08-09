'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { ScheduleEventDto } from '@/lib/scheduling-types';

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Scheduling board — scheduling-prd.md §13: "week board showing every
 * Technician's day/week at a glance." A single-week list view, not a
 * full drag-and-drop calendar (scheduling-prd.md §4 explicitly scopes
 * out algorithmic auto-scheduling; a full calendar widget is likewise
 * more than this sprint's documented UI requirement calls for — see
 * SPRINT-4-COMPLETION-REPORT.md, "Deviations From Documentation").
 * Respects Organization boundaries and Permissions via the
 * `/api/v1/schedule` endpoint (Dispatcher/Admin/Owner see the full
 * board; a Technician sees only their own Schedule Events).
 */
export default function SchedulePage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <SchedulePageContent />
    </Suspense>
  );
}

function SchedulePageContent(): JSX.Element {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [events, setEvents] = useState<ScheduleEventDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setError(null);
    try {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const qs = new URLSearchParams({
        organization_id: organizationId,
        start: weekStart.toISOString(),
        end: weekEnd.toISOString(),
      });
      const result = await apiRequest<ScheduleEventDto[]>(`/api/v1/schedule?${qs.toString()}`);
      setEvents(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the schedule.');
    }
  }, [organizationId, weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!organizationId) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="text-muted-foreground text-sm">
          Add <code className="bg-muted rounded px-1 py-0.5">?organization_id=&lt;id&gt;</code> to
          the URL to view the schedule for an Organization.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Schedule</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const d = new Date(weekStart);
              d.setDate(d.getDate() - 7);
              setWeekStart(d);
            }}
          >
            ← Previous week
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const d = new Date(weekStart);
              d.setDate(d.getDate() + 7);
              setWeekStart(d);
            }}
          >
            Next week →
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground mb-4 text-sm">Week of {weekStart.toLocaleDateString()}</p>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left">
            <th className="py-2">Start</th>
            <th className="py-2">End</th>
            <th className="py-2">Job</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-border border-b">
              <td className="py-2">{new Date(event.scheduled_start).toLocaleString()}</td>
              <td className="py-2">{new Date(event.scheduled_end).toLocaleString()}</td>
              <td className="py-2">
                <Link
                  className="hover:underline"
                  href={`/jobs/${event.job_id}?organization_id=${organizationId}`}
                >
                  View Job
                </Link>
              </td>
            </tr>
          ))}
          {events.length === 0 ? (
            <tr>
              <td className="text-muted-foreground py-4" colSpan={3}>
                No Jobs scheduled this week.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </main>
  );
}
