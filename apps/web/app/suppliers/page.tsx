'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Input, Label } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { SupplierDto } from '@/lib/inventory-types';

/** Supplier list — suppliers-prd.md §13: "Supplier list/detail page." */
export default function SuppliersPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <SuppliersPageContent />
    </Suspense>
  );
}

function SuppliersPageContent(): JSX.Element {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
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
        const result = await apiRequest<SupplierDto[]>(`/api/v1/suppliers?${params.toString()}`);
        setSuppliers((prev) => (opts.append ? [...prev, ...result.data] : result.data));
        setCursor(result.meta?.next_cursor ?? null);
        setHasMore(result.meta?.has_more ?? false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Suppliers.');
      } finally {
        setLoading(false);
      }
    },
    [organizationId],
  );

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  if (!organizationId) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="text-muted-foreground text-sm">
          Add <code className="bg-muted rounded px-1 py-0.5">?organization_id=&lt;id&gt;</code> to
          the URL to view Suppliers for an Organization.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : '+ New Supplier'}
        </Button>
      </div>

      {showCreate ? (
        <CreateSupplierForm
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
            <th className="py-2">Name</th>
            <th className="py-2">Contact</th>
            <th className="py-2">Account #</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => (
            <tr key={supplier.id} className="border-border border-b">
              <td className="py-2">
                <Link
                  className="hover:underline"
                  href={`/suppliers/${supplier.id}?organization_id=${organizationId}`}
                >
                  {supplier.name}
                </Link>
              </td>
              <td className="py-2">{supplier.contact_name ?? '—'}</td>
              <td className="py-2">{supplier.account_number ?? '—'}</td>
            </tr>
          ))}
          {suppliers.length === 0 && !loading ? (
            <tr>
              <td className="text-muted-foreground py-4" colSpan={3}>
                No Suppliers found.
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

function CreateSupplierForm({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated: () => void;
}): JSX.Element {
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest('/api/v1/suppliers', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          name,
          ...(contactName ? { contact_name: contactName } : {}),
          ...(accountNumber ? { account_number: accountNumber } : {}),
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Supplier.');
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
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="contact_name">Contact Name</Label>
          <Input
            id="contact_name"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="account_number">Account #</Label>
          <Input
            id="account_number"
            value={accountNumber}
            onChange={(event) => setAccountNumber(event.target.value)}
          />
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Supplier'}
        </Button>
      </div>
    </form>
  );
}
