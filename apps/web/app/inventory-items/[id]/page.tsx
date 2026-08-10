'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button, Input, Label } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { InventoryItemDetailDto, InventoryLocationDto } from '@/lib/inventory-types';

/** Inventory Item detail — inventory-prd.md §13: per-location quantity columns; stock adjustment action. */
export default function InventoryItemDetailPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <InventoryItemDetailContent />
    </Suspense>
  );
}

function InventoryItemDetailContent(): JSX.Element {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [item, setItem] = useState<InventoryItemDetailDto | null>(null);
  const [locations, setLocations] = useState<InventoryLocationDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setError(null);
    try {
      const [itemResult, locationsResult] = await Promise.all([
        apiRequest<InventoryItemDetailDto>(
          `/api/v1/inventory-items/${params.id}?organization_id=${organizationId}`,
        ),
        apiRequest<InventoryLocationDto[]>(
          `/api/v1/inventory-locations?organization_id=${organizationId}`,
        ),
      ]);
      setItem(itemResult.data);
      setLocations(locationsResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Inventory Item.');
    }
  }, [organizationId, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

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

  if (!item) {
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

  const locationById = new Map(locations.map((l) => [l.id, l]));

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{item.sku}</h1>
        <span className="text-muted-foreground text-sm">${item.unit_cost} / unit</span>
      </div>
      <p className="text-muted-foreground mb-6 text-sm">{item.description}</p>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <h2 className="mb-2 text-lg font-medium">Quantity on Hand</h2>
      <table className="mb-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left">
            <th className="py-2">Location</th>
            <th className="py-2">Quantity on Hand</th>
          </tr>
        </thead>
        <tbody>
          {item.quantity_by_location.map((q) => (
            <tr key={q.location_id} className="border-border border-b">
              <td className="py-2">{locationById.get(q.location_id)?.name ?? q.location_id}</td>
              <td className="py-2">{q.quantity_on_hand}</td>
            </tr>
          ))}
          {item.quantity_by_location.length === 0 ? (
            <tr>
              <td className="text-muted-foreground py-4" colSpan={2}>
                No stock movements recorded yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <AdjustStockForm
        organizationId={organizationId}
        inventoryItemId={item.id}
        locations={locations}
        onAdjusted={() => void load()}
      />
    </main>
  );
}

function AdjustStockForm({
  organizationId,
  inventoryItemId,
  locations,
  onAdjusted,
}: {
  organizationId: string;
  inventoryItemId: string;
  locations: InventoryLocationDto[];
  onAdjusted: () => void;
}): JSX.Element {
  const [locationId, setLocationId] = useState('');
  const [reason, setReason] = useState<'received' | 'adjusted'>('received');
  const [quantityDelta, setQuantityDelta] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/inventory-items/${inventoryItemId}/adjust`, {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          location_id: locationId,
          reason,
          quantity_delta: Number(quantityDelta),
          ...(notes ? { notes } : {}),
        }),
      });
      setQuantityDelta('');
      setNotes('');
      onAdjusted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust stock.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="border-border flex flex-col gap-3 rounded-md border p-4">
      <h2 className="text-lg font-medium">Adjust Stock</h2>
      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="location">Location</Label>
          <select
            id="location"
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
        <div className="flex-1">
          <Label htmlFor="reason">Reason</Label>
          <select
            id="reason"
            className="border-border w-full rounded-md border px-3 py-2 text-sm"
            value={reason}
            onChange={(event) => setReason(event.target.value as 'received' | 'adjusted')}
          >
            <option value="received">Received</option>
            <option value="adjusted">Adjusted (reconciliation)</option>
          </select>
        </div>
        <div className="flex-1">
          <Label htmlFor="quantity_delta">
            {reason === 'received' ? 'Quantity Received' : 'Quantity Delta (+/-)'}
          </Label>
          <Input
            id="quantity_delta"
            required
            value={quantityDelta}
            onChange={(event) => setQuantityDelta(event.target.value)}
          />
        </div>
      </div>
      {reason === 'adjusted' ? (
        <div>
          <Label htmlFor="notes">Reason for adjustment (required)</Label>
          <Input
            id="notes"
            required
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Record Movement'}
        </Button>
      </div>
    </form>
  );
}
