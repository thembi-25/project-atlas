'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Input, Label } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { CustomerDto } from '@/lib/crm-types';

/**
 * Customer list — customers-prd.md §13: "Quick-create modal (accessible
 * from the global '+ New' action...)". No global app shell/organization
 * switcher exists yet (Sprint 1 built no staff-app UI at all), so the
 * active Organization is read from `?organization_id=` for now — see
 * SPRINT-2-COMPLETION-REPORT.md, "Known Limitations."
 */
export default function CustomersPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <CustomersPageContent />
    </Suspense>
  );
}

function CustomersPageContent(): JSX.Element {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [customers, setCustomers] = useState<CustomerDto[]>([]);
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
        if (opts.cursor) params.set('cursor', opts.cursor);
        const result = await apiRequest<CustomerDto[]>(`/api/v1/customers?${params.toString()}`);
        setCustomers((prev) => (opts.append ? [...prev, ...result.data] : result.data));
        setCursor(result.meta?.next_cursor ?? null);
        setHasMore(result.meta?.has_more ?? false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Customers.');
      } finally {
        setLoading(false);
      }
    },
    [organizationId, search],
  );

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, search]);

  if (!organizationId) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="text-muted-foreground text-sm">
          Add <code className="bg-muted rounded px-1 py-0.5">?organization_id=&lt;id&gt;</code> to
          the URL to view Customers for an Organization.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : '+ New Customer'}
        </Button>
      </div>

      {showCreate ? (
        <CreateCustomerForm
          organizationId={organizationId}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      ) : null}

      <div className="mb-4">
        <Input
          placeholder="Search by name, phone, or email…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left">
            <th className="py-2">Name</th>
            <th className="py-2">Type</th>
            <th className="py-2">City</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id} className="border-border border-b">
              <td className="py-2">
                <Link className="hover:underline" href={`/customers/${customer.id}`}>
                  {customer.display_name}
                </Link>
              </td>
              <td className="py-2 capitalize">{customer.type}</td>
              <td className="py-2">{customer.billing_address_city ?? '—'}</td>
            </tr>
          ))}
          {customers.length === 0 && !loading ? (
            <tr>
              <td className="text-muted-foreground py-4" colSpan={3}>
                No Customers found.
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

function CreateCustomerForm({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated: () => void;
}): JSX.Element {
  const [type, setType] = useState<'residential' | 'commercial'>('residential');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest('/api/v1/customers', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          type,
          display_name: displayName,
          primary_contact:
            phone || email ? { phone: phone || undefined, email: email || undefined } : undefined,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Customer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="border-border mb-6 flex flex-col gap-3 rounded-md border p-4"
    >
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={type === 'residential'}
            onChange={() => setType('residential')}
          />
          Residential
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={type === 'commercial'}
            onChange={() => setType('commercial')}
          />
          Commercial
        </label>
      </div>
      <div>
        <Label htmlFor="display_name">Name</Label>
        <Input
          id="display_name"
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </div>
        <div className="flex-1">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Customer'}
        </Button>
      </div>
    </form>
  );
}
