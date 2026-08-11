'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api-client';
import type {
  InvoiceAgingDto,
  JobVolumeByTypeDto,
  RevenueByPeriodDto,
  StalenessMeta,
  TechnicianUtilizationDto,
} from '@/lib/analytics-types';

/**
 * Analytics dashboard — analytics-prd.md §13: "Dashboard home page with
 * the core widgets, each showing a 'data as of HH:MM' staleness
 * indicator." No drill-down to underlying Job/Invoice lists in this
 * minimal UI pass — see docs/13-roadmap/SPRINT-7-COMPLETION-REPORT.md,
 * Known Limitations.
 */
export default function AnalyticsPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <AnalyticsPageContent />
    </Suspense>
  );
}

function StalenessLabel({ meta }: { meta: StalenessMeta }): JSX.Element {
  const asOf = meta.as_of ? new Date(meta.as_of).toLocaleString() : 'never refreshed';
  return (
    <p className={`text-xs ${meta.is_stale ? 'text-amber-600' : 'text-muted-foreground'}`}>
      Data as of {asOf}
      {meta.is_stale ? ' — stale, refresh overdue' : ''}
    </p>
  );
}

function AnalyticsPageContent(): JSX.Element {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [revenue, setRevenue] = useState<{ rows: RevenueByPeriodDto[]; meta: StalenessMeta } | null>(null);
  const [jobVolume, setJobVolume] = useState<{ rows: JobVolumeByTypeDto[]; meta: StalenessMeta } | null>(null);
  const [utilization, setUtilization] = useState<{
    rows: TechnicianUtilizationDto[];
    meta: StalenessMeta & { scope: string };
  } | null>(null);
  const [invoiceAging, setInvoiceAging] = useState<{ rows: InvoiceAgingDto[]; meta: StalenessMeta } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    const qs = `organization_id=${organizationId}`;
    setError(null);

    void apiRequest<RevenueByPeriodDto[]>(`/api/v1/analytics/revenue?${qs}`)
      .then((r) => setRevenue({ rows: r.data, meta: r.meta as unknown as StalenessMeta }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load revenue.'));

    void apiRequest<JobVolumeByTypeDto[]>(`/api/v1/analytics/job-volume?${qs}`)
      .then((r) => setJobVolume({ rows: r.data, meta: r.meta as unknown as StalenessMeta }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load job volume.'));

    void apiRequest<TechnicianUtilizationDto[]>(`/api/v1/analytics/utilization?${qs}`)
      .then((r) => setUtilization({ rows: r.data, meta: r.meta as unknown as StalenessMeta & { scope: string } }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load utilization.'));

    void apiRequest<InvoiceAgingDto[]>(`/api/v1/analytics/invoice-aging?${qs}`)
      .then((r) => setInvoiceAging({ rows: r.data, meta: r.meta as unknown as StalenessMeta }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load invoice aging.'));
  }, [organizationId]);

  if (!organizationId) {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <p className="text-muted-foreground text-sm">
          Add <code className="bg-muted rounded px-1 py-0.5">?organization_id=&lt;id&gt;</code> to
          the URL to view Analytics for an Organization.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Analytics</h1>
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="border-border rounded-md border p-4">
          <h2 className="mb-1 text-lg font-medium">Revenue by Period</h2>
          {revenue ? <StalenessLabel meta={revenue.meta} /> : null}
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="py-1">Period</th>
                <th className="py-1">Revenue</th>
                <th className="py-1">Payments</th>
              </tr>
            </thead>
            <tbody>
              {revenue?.rows.map((row) => (
                <tr key={row.period} className="border-border border-t">
                  <td className="py-1">{new Date(row.period).toLocaleDateString()}</td>
                  <td className="py-1">${row.total_revenue}</td>
                  <td className="py-1">{row.payment_count}</td>
                </tr>
              ))}
              {revenue && revenue.rows.length === 0 ? (
                <tr>
                  <td className="text-muted-foreground py-2" colSpan={3}>
                    No revenue recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="border-border rounded-md border p-4">
          <h2 className="mb-1 text-lg font-medium">Job Volume by Type</h2>
          {jobVolume ? <StalenessLabel meta={jobVolume.meta} /> : null}
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="py-1">Job Type</th>
                <th className="py-1">Status</th>
                <th className="py-1">Count</th>
              </tr>
            </thead>
            <tbody>
              {jobVolume?.rows.map((row) => (
                <tr key={`${row.job_type_id}-${row.status}`} className="border-border border-t">
                  <td className="py-1">{row.job_type_id}</td>
                  <td className="py-1">{row.status}</td>
                  <td className="py-1">{row.job_count}</td>
                </tr>
              ))}
              {jobVolume && jobVolume.rows.length === 0 ? (
                <tr>
                  <td className="text-muted-foreground py-2" colSpan={3}>
                    No Jobs recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="border-border rounded-md border p-4">
          <h2 className="mb-1 text-lg font-medium">
            Technician Utilization
            {utilization ? (
              <span className="text-muted-foreground ml-2 text-xs font-normal">
                ({utilization.meta.scope} scope)
              </span>
            ) : null}
          </h2>
          {utilization ? <StalenessLabel meta={utilization.meta} /> : null}
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="py-1">Technician</th>
                <th className="py-1">Week</th>
                <th className="py-1">Scheduled Hours</th>
                <th className="py-1">Jobs</th>
              </tr>
            </thead>
            <tbody>
              {utilization?.rows.map((row) => (
                <tr key={`${row.technician_user_id}-${row.period}`} className="border-border border-t">
                  <td className="py-1">{row.technician_user_id}</td>
                  <td className="py-1">{new Date(row.period).toLocaleDateString()}</td>
                  <td className="py-1">{row.scheduled_hours}</td>
                  <td className="py-1">{row.job_count}</td>
                </tr>
              ))}
              {utilization && utilization.rows.length === 0 ? (
                <tr>
                  <td className="text-muted-foreground py-2" colSpan={4}>
                    No scheduled hours recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="border-border rounded-md border p-4">
          <h2 className="mb-1 text-lg font-medium">Invoice Aging</h2>
          {invoiceAging ? <StalenessLabel meta={invoiceAging.meta} /> : null}
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="py-1">Invoice</th>
                <th className="py-1">Balance Due</th>
                <th className="py-1">Days Overdue</th>
              </tr>
            </thead>
            <tbody>
              {invoiceAging?.rows.map((row) => (
                <tr key={row.invoice_id} className="border-border border-t">
                  <td className="py-1">#{row.invoice_number}</td>
                  <td className="py-1">${row.balance_due}</td>
                  <td className="py-1">{row.days_overdue}</td>
                </tr>
              ))}
              {invoiceAging && invoiceAging.rows.length === 0 ? (
                <tr>
                  <td className="text-muted-foreground py-2" colSpan={3}>
                    No outstanding Invoices.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
