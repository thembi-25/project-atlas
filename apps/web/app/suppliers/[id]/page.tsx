'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button, Input, Label } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { SupplierDto } from '@/lib/inventory-types';

/** Supplier detail — suppliers-prd.md §13. */
export default function SupplierDetailPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <SupplierDetailContent />
    </Suspense>
  );
}

function SupplierDetailContent(): JSX.Element {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [supplier, setSupplier] = useState<SupplierDto | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setError(null);
    try {
      const result = await apiRequest<SupplierDto>(
        `/api/v1/suppliers/${params.id}?organization_id=${organizationId}`,
      );
      setSupplier(result.data);
      setNotes(result.data.notes ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Supplier.');
    }
  }, [organizationId, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveNotes = async () => {
    if (!organizationId) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/suppliers/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ organization_id: organizationId, notes }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes.');
    } finally {
      setSaving(false);
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

  if (!supplier) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <p className="text-muted-foreground text-sm">Loading…</p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-2 text-2xl font-semibold">{supplier.name}</h1>
      <dl className="mb-6 grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted-foreground">Contact</dt>
        <dd>{supplier.contact_name ?? '—'}</dd>
        <dt className="text-muted-foreground">Email</dt>
        <dd>{supplier.email ?? '—'}</dd>
        <dt className="text-muted-foreground">Phone</dt>
        <dd>{supplier.phone ?? '—'}</dd>
        <dt className="text-muted-foreground">Account #</dt>
        <dd>{supplier.account_number ?? '—'}</dd>
      </dl>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <div className="mt-2">
          <Button disabled={saving} onClick={() => void saveNotes()}>
            {saving ? 'Saving…' : 'Save Notes'}
          </Button>
        </div>
      </div>
    </main>
  );
}
