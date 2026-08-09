'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { AssetDto } from '@/lib/assets-types';

/**
 * Asset detail page — assets-prd.md §13: "Asset detail page with
 * manufacturer/model/serial, install date, linked Warranties, and Job
 * history." Warranties and Jobs don't exist yet this sprint, so only the
 * documented Asset fields and status are shown — no AI diagnostics,
 * manufacturer lookup, maintenance prediction, IoT data, or automated
 * service recommendations (explicitly out of scope — see
 * docs/13-roadmap/SPRINT-3-COMPLETION-REPORT.md, "Known Limitations").
 */
export default function AssetDetailPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <AssetDetailPageContent />
    </Suspense>
  );
}

function AssetDetailPageContent(): JSX.Element {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [asset, setAsset] = useState<AssetDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setError(null);
    try {
      const qs = new URLSearchParams({ organization_id: organizationId });
      const result = await apiRequest<AssetDto>(`/api/v1/assets/${params.id}?${qs.toString()}`);
      setAsset(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Asset.');
    }
  }, [organizationId, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const decommission = async () => {
    if (!organizationId || !asset) return;
    if (!confirm('Mark this Asset decommissioned?')) return;
    try {
      await apiRequest(`/api/v1/assets/${asset.id}/decommission`, {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId, status: 'decommissioned' }),
      });
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decommission Asset.');
    }
  };

  if (!organizationId) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-muted-foreground text-sm">
          Add <code className="bg-muted rounded px-1 py-0.5">?organization_id=&lt;id&gt;</code> to
          the URL.
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-sm text-red-600">{error}</p>
      </main>
    );
  }

  if (!asset) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {asset.manufacturer_name ?? 'Asset'} {asset.model_number ?? ''}
          </h1>
          <p className="text-muted-foreground text-sm capitalize">
            {asset.status}
            {asset.deleted_at ? ' · archived' : ''}
          </p>
        </div>
        {asset.status === 'active' ? (
          <Button variant="destructive" onClick={() => void decommission()}>
            Decommission
          </Button>
        ) : null}
      </div>

      <dl className="mb-8 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Manufacturer</dt>
        <dd>{asset.manufacturer_name ?? '—'}</dd>
        <dt className="text-muted-foreground">Model number</dt>
        <dd>{asset.model_number ?? '—'}</dd>
        <dt className="text-muted-foreground">Serial number</dt>
        <dd>{asset.serial_number ?? '—'}</dd>
        <dt className="text-muted-foreground">Install date</dt>
        <dd>{asset.install_date ?? 'Unknown'}</dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd className="capitalize">{asset.status}</dd>
      </dl>

      <h2 className="mb-3 text-lg font-semibold">Job history</h2>
      <p className="text-muted-foreground text-sm">
        Job history will appear here once the Jobs module is implemented.
      </p>
    </main>
  );
}
