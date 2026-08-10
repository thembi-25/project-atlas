'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Input, Label } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { InventoryLocationDto, PurchaseOrderDto, SupplierDto } from '@/lib/inventory-types';

/** Purchase Order list — suppliers-prd.md §13: "simple Purchase Order list with status." */
export default function PurchaseOrdersPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <PurchaseOrdersPageContent />
    </Suspense>
  );
}

function PurchaseOrdersPageContent(): JSX.Element {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [orders, setOrders] = useState<PurchaseOrderDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [locations, setLocations] = useState<InventoryLocationDto[]>([]);
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
        const result = await apiRequest<PurchaseOrderDto[]>(
          `/api/v1/purchase-orders?${params.toString()}`,
        );
        setOrders((prev) => (opts.append ? [...prev, ...result.data] : result.data));
        setCursor(result.meta?.next_cursor ?? null);
        setHasMore(result.meta?.has_more ?? false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Purchase Orders.');
      } finally {
        setLoading(false);
      }
    },
    [organizationId],
  );

  const loadReferenceData = useCallback(async () => {
    if (!organizationId) return;
    try {
      const [suppliersResult, locationsResult] = await Promise.all([
        apiRequest<SupplierDto[]>(`/api/v1/suppliers?organization_id=${organizationId}&limit=100`),
        apiRequest<InventoryLocationDto[]>(
          `/api/v1/inventory-locations?organization_id=${organizationId}`,
        ),
      ]);
      setSuppliers(suppliersResult.data);
      setLocations(locationsResult.data);
    } catch {
      // Reference data is only needed for the create form; a failure here doesn't block the list.
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
    void loadReferenceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  if (!organizationId) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="text-muted-foreground text-sm">
          Add <code className="bg-muted rounded px-1 py-0.5">?organization_id=&lt;id&gt;</code> to
          the URL to view Purchase Orders for an Organization.
        </p>
      </main>
    );
  }

  const supplierById = new Map(suppliers.map((s) => [s.id, s]));

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Purchase Orders</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : '+ New Purchase Order'}
        </Button>
      </div>

      {showCreate ? (
        <CreatePurchaseOrderForm
          organizationId={organizationId}
          suppliers={suppliers}
          locations={locations}
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
            <th className="py-2">Supplier</th>
            <th className="py-2">Status</th>
            <th className="py-2">Ordered</th>
            <th className="py-2">Received</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-border border-b">
              <td className="py-2">
                <Link
                  className="hover:underline"
                  href={`/purchase-orders/${order.id}?organization_id=${organizationId}`}
                >
                  {supplierById.get(order.supplier_id)?.name ?? order.supplier_id}
                </Link>
              </td>
              <td className="py-2 capitalize">{order.status}</td>
              <td className="py-2">
                {order.ordered_at ? new Date(order.ordered_at).toLocaleDateString() : '—'}
              </td>
              <td className="py-2">
                {order.received_at ? new Date(order.received_at).toLocaleDateString() : '—'}
              </td>
            </tr>
          ))}
          {orders.length === 0 && !loading ? (
            <tr>
              <td className="text-muted-foreground py-4" colSpan={4}>
                No Purchase Orders found.
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

interface DraftLine {
  inventory_item_id: string;
  quantity_ordered: string;
  unit_cost: string;
}

function CreatePurchaseOrderForm({
  organizationId,
  suppliers,
  locations,
  onCreated,
}: {
  organizationId: string;
  suppliers: SupplierDto[];
  locations: InventoryLocationDto[];
  onCreated: () => void;
}): JSX.Element {
  const [supplierId, setSupplierId] = useState('');
  const [receivingLocationId, setReceivingLocationId] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([
    { inventory_item_id: '', quantity_ordered: '1', unit_cost: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateLine = (index: number, field: keyof DraftLine, value: string) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest('/api/v1/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          supplier_id: supplierId,
          receiving_location_id: receivingLocationId,
          line_items: lines
            .filter((line) => line.inventory_item_id && line.unit_cost)
            .map((line) => ({
              inventory_item_id: line.inventory_item_id,
              quantity_ordered: Number(line.quantity_ordered),
              unit_cost: Number(line.unit_cost),
            })),
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Purchase Order.');
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
          <Label htmlFor="supplier">Supplier</Label>
          <select
            id="supplier"
            required
            className="border-border w-full rounded-md border px-3 py-2 text-sm"
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
          >
            <option value="">Select a supplier…</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <Label htmlFor="receiving_location">Receiving Location</Label>
          <select
            id="receiving_location"
            required
            className="border-border w-full rounded-md border px-3 py-2 text-sm"
            value={receivingLocationId}
            onChange={(event) => setReceivingLocationId(event.target.value)}
          >
            <option value="">Select a location…</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Line Items (Inventory Item ID)</Label>
        {lines.map((line, index) => (
          <div key={index} className="flex gap-2">
            <Input
              placeholder="Inventory Item ID"
              className="flex-1"
              value={line.inventory_item_id}
              onChange={(event) => updateLine(index, 'inventory_item_id', event.target.value)}
            />
            <Input
              placeholder="Qty"
              className="w-20"
              value={line.quantity_ordered}
              onChange={(event) => updateLine(index, 'quantity_ordered', event.target.value)}
            />
            <Input
              placeholder="Unit cost"
              className="w-28"
              value={line.unit_cost}
              onChange={(event) => updateLine(index, 'unit_cost', event.target.value)}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setLines((prev) => [
              ...prev,
              { inventory_item_id: '', quantity_ordered: '1', unit_cost: '' },
            ])
          }
        >
          + Add line item
        </Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Purchase Order'}
        </Button>
      </div>
    </form>
  );
}
