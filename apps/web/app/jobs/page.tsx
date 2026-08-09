'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Input, Label } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { JobDto, JobPriority, JobStatus, JobTypeDto } from '@/lib/jobs-types';

const JOB_STATUSES: JobStatus[] = [
  'draft',
  'scheduled',
  'dispatched',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
];

/**
 * Job list — jobs-prd.md §13: filterable by status/priority/Job Type.
 * No global app shell/organization switcher exists yet, so the active
 * Organization is read from `?organization_id=`, matching the
 * Customers/Properties list precedent.
 */
export default function JobsPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <JobsPageContent />
    </Suspense>
  );
}

function JobsPageContent(): JSX.Element {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [jobs, setJobs] = useState<JobDto[]>([]);
  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('');
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(
    async (opts: { cursor?: string | null; append?: boolean } = {}) => {
      if (!organizationId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ organization_id: organizationId, limit: '25' });
        if (search) params.set('search', search);
        if (statusFilter) params.set('status', statusFilter);
        if (opts.cursor) params.set('cursor', opts.cursor);
        const result = await apiRequest<JobDto[]>(`/api/v1/jobs?${params.toString()}`);
        setJobs((prev) => (opts.append ? [...prev, ...result.data] : result.data));
        setCursor(result.meta?.next_cursor ?? null);
        setHasMore(result.meta?.has_more ?? false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Jobs.');
      } finally {
        setLoading(false);
      }
    },
    [organizationId, search, statusFilter],
  );

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, search, statusFilter]);

  if (!organizationId) {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <p className="text-muted-foreground text-sm">
          Add <code className="bg-muted rounded px-1 py-0.5">?organization_id=&lt;id&gt;</code> to
          the URL to view Jobs for an Organization.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : '+ New Job'}
        </Button>
      </div>

      {showCreate ? (
        <CreateJobForm
          organizationId={organizationId}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      ) : null}

      <div className="mb-4 flex gap-3">
        <Input
          placeholder="Search by job number, customer, address…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="border-border rounded-md border bg-transparent px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as JobStatus | '')}
        >
          <option value="">All statuses</option>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left">
            <th className="py-2">Job #</th>
            <th className="py-2">Status</th>
            <th className="py-2">Priority</th>
            <th className="py-2">Description</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-border border-b">
              <td className="py-2">
                <Link className="hover:underline" href={`/jobs/${job.id}`}>
                  #{job.job_number}
                </Link>
              </td>
              <td className="py-2">{job.status}</td>
              <td className="py-2">{job.priority}</td>
              <td className="py-2">{job.description ?? '—'}</td>
            </tr>
          ))}
          {jobs.length === 0 && !loading ? (
            <tr>
              <td className="text-muted-foreground py-4" colSpan={4}>
                No Jobs found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {hasMore ? (
        <div className="mt-4">
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void load({ cursor, append: true })}
          >
            {loading ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </main>
  );
}

function CreateJobForm({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated: () => void;
}): JSX.Element {
  const [jobTypes, setJobTypes] = useState<JobTypeDto[]>([]);
  const [jobTypeId, setJobTypeId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [priority, setPriority] = useState<JobPriority>('normal');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const result = await apiRequest<JobTypeDto[]>(
          `/api/v1/job_types?organization_id=${organizationId}`,
        );
        setJobTypes(result.data);
        if (result.data[0]) setJobTypeId(result.data[0].id);
      } catch {
        // Job Type select stays empty; the form still validates on submit.
      }
    })();
  }, [organizationId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiRequest<{ job: JobDto }>('/api/v1/jobs', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          job_type_id: jobTypeId,
          customer_id: customerId,
          property_id: propertyId,
          priority,
          description: description || undefined,
        }),
      });
      void result;
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Job.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="border-border mb-6 flex flex-col gap-3 rounded-md border p-4"
    >
      <div>
        <Label htmlFor="job_type_id">Job type</Label>
        <select
          id="job_type_id"
          required
          className="border-border w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          value={jobTypeId}
          onChange={(event) => setJobTypeId(event.target.value)}
        >
          <option value="" disabled>
            Select a Job Type…
          </option>
          {jobTypes.map((jt) => (
            <option key={jt.id} value={jt.id}>
              {jt.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="customer_id">Customer ID</Label>
        <Input
          id="customer_id"
          required
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="property_id">Property ID</Label>
        <Input
          id="property_id"
          required
          value={propertyId}
          onChange={(event) => setPropertyId(event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="priority">Priority</Label>
        <select
          id="priority"
          className="border-border w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          value={priority}
          onChange={(event) => setPriority(event.target.value as JobPriority)}
        >
          <option value="normal">Normal</option>
          <option value="urgent">Urgent</option>
          <option value="emergency">Emergency</option>
        </select>
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Job'}
        </Button>
      </div>
    </form>
  );
}
