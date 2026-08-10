'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Input, Label } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { InventoryItemDto, InventoryLocationDto, LowStockRowDto } from '@/lib/inventory-types';

/**
 * Inventory Item list — inventory-prd.md §13: "Inventory Item list with
 * per-location quantity columns" (quantity columns live on the detail
 * page, since a list-level per-location breakdown would require an
 * unbounded number of columns) plus the "low-stock dashboard widget."
 */
export default function InventoryItemsPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <InventoryItemsPageContent />
    </Suspense>
  );
}

function InventoryItemsPageContent(): JSX.Element {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [items, setItems] = useState<InventoryItemDto[]>([]);
  const [lowStock, setLowStock] = useState<LowStockRowDto[]>([]);
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
        if (opts.cursor) params.set('cursor', opts.cursor);
        const result = await apiRequest<InventoryItemDto[]>(
          `/api/v1/inventory-items?${params.toString()}`,
        );
        setItems((prev) => (opts.append ? [...prev, ...result.data] : result.data));
        setCursor(result.meta?.next_cursor ?? null);
        setHasMore(result.meta?.has_more ?? false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Inventory Items.');
      } finally {
        setLoading(false);
      }
    },
    [organizationId],
  );

  const loadLowStock = useCallback(async () => {
    if (!organizationId) return;
    try {
      const result = await apiRequest<LowStockRowDto[]>(
        `/api/v1/inventory/low-stock?organization_id=${organizationId}`,
      );
      setLowStock(result.data);
    } catch {
      // Non-critical widget — a load failure here doesn't block the main list.
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
    void loadLowStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  if (!organizationId) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="text-muted-foreground text-sm">
          Add <code className="bg-muted rounded px-1 py-0.5">?organization_id=&lt;id&gt;</code> to
          the URL to view Inventory for an Organization.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Inventory Items</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : '+ New Item'}
        </Button>
      </div>

      {lowStock.length > 0 ? (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="mb-2 font-semibold text-amber-800">Low Stock</p>
          <ul className="space-y-1 text-amber-900">
            {lowStock.map((row) => (
              <li key={`${row.inventory_item_id}-${row.location_id}`}>
                {row.sku} at {row.location_name}: {row.quantity_on_hand} on hand (threshold{' '}
                {row.low_stock_threshold})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showCreate ? (
        <CreateInventoryItemForm
          organizationId={organizationId}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      ) : null}

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left">
            <th className="py-2">SKU</th>
            <th className="py-2">Description</th>
            <th className="py-2">Unit Cost</th>
            <th className="py-2">Active</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-border border-b">
              <td className="py-2">
                <Link
                  className="hover:underline"
                  href={`/inventory-items/${item.id}?organization_id=${organizationId}`}
                >
                  {item.sku}
                </Link>
              </td>
              <td className="py-2">{item.description}</td>
              <td className="py-2">${item.unit_cost}</td>
              <td className="py-2">{item.is_active ? 'Yes' : 'No'}</td>
            </tr>
          ))}
          {items.length === 0 && !loading ? (
            <tr>
              <td className="text-muted-foreground py-4" colSpan={4}>
                No Inventory Items found.
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

      <LocationsSection organizationId={organizationId} />
    </main>
  );
}

function LocationsSection({ organizationId }: { organizationId: string }): JSX.Element {
  const [locations, setLocations] = useState<InventoryLocationDto[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<'warehouse' | 'truck'>('warehouse');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await apiRequest<InventoryLocationDto[]>(
        `/api/v1/inventory-locations?organization_id=${organizationId}`,
      );
      setLocations(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Locations.');
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest('/api/v1/inventory-locations', {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId, type, name }),
      });
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Location.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="border-border mt-10 rounded-md border p-4">
      <h2 className="mb-3 text-lg font-medium">Locations</h2>
      <ul className="mb-4 space-y-1 text-sm">
        {locations.map((location) => (
          <li key={location.id}>
            {location.name} <span className="text-muted-foreground">({location.type})</span>
          </li>
        ))}
        {locations.length === 0 ? (
          <li className="text-muted-foreground">
            No Locations yet — add a Warehouse or Truck below.
          </li>
        ) : null}
      </ul>
      <form onSubmit={submit} className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="location_name">Name</Label>
          <Input
            id="location_name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="location_type">Type</Label>
          <select
            id="location_type"
            className="border-border rounded-md border px-3 py-2 text-sm"
            value={type}
            onChange={(event) => setType(event.target.value as 'warehouse' | 'truck')}
          >
            <option value="warehouse">Warehouse</option>
            <option value="truck">Truck</option>
          </select>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Adding…' : '+ Add Location'}
        </Button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}

function CreateInventoryItemForm({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated: () => void;
}): JSX.Element {
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest('/api/v1/inventory-items', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          sku,
          description,
          unit_cost: Number(unitCost || 0),
          ...(lowStockThreshold ? { low_stock_threshold: Number(lowStockThreshold) } : {}),
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Inventory Item.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="border-border mb-6 flex flex-col gap-3 rounded-md border p-4"
    >
      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" required value={sku} onChange={(event) => setSku(event.target.value)} />
        </div>
        <div className="flex-1">
          <Label htmlFor="unit_cost">Unit Cost</Label>
          <Input
            id="unit_cost"
            required
            value={unitCost}
            onChange={(event) => setUnitCost(event.target.value)}
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="low_stock_threshold">Low Stock Threshold</Label>
          <Input
            id="low_stock_threshold"
            value={lowStockThreshold}
            onChange={(event) => setLowStockThreshold(event.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Item'}
        </Button>
      </div>
    </form>
  );
}
