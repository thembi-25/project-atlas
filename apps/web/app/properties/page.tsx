'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Input, Label } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { PropertyDto } from '@/lib/properties-types';

const PROPERTY_TYPES = [
  { value: 'residential_single_family', label: 'Residential (single-family)' },
  { value: 'residential_multi_unit', label: 'Residential (multi-unit)' },
  { value: 'commercial', label: 'Commercial' },
] as const;

/**
 * Property list — properties-prd.md §13. No global app shell/organization
 * switcher exists yet, so the active Organization is read from
 * `?organization_id=` for now, matching the Customers list precedent
 * (SPRINT-2-COMPLETION-REPORT.md, "Known Limitations").
 */
export default function PropertiesPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <PropertiesPageContent />
    </Suspense>
  );
}

function PropertiesPageContent(): JSX.Element {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [properties, setProperties] = useState<PropertyDto[]>([]);
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
        const result = await apiRequest<PropertyDto[]>(`/api/v1/properties?${params.toString()}`);
        setProperties((prev) => (opts.append ? [...prev, ...result.data] : result.data));
        setCursor(result.meta?.next_cursor ?? null);
        setHasMore(result.meta?.has_more ?? false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Properties.');
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
          the URL to view Properties for an Organization.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Properties</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : '+ New Property'}
        </Button>
      </div>

      {showCreate ? (
        <CreatePropertyForm
          organizationId={organizationId}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      ) : null}

      <div className="mb-4">
        <Input
          placeholder="Search by address…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left">
            <th className="py-2">Address</th>
            <th className="py-2">Type</th>
            <th className="py-2">City</th>
          </tr>
        </thead>
        <tbody>
          {properties.map((property) => (
            <tr key={property.id} className="border-border border-b">
              <td className="py-2">
                <Link className="hover:underline" href={`/properties/${property.id}`}>
                  {property.address_line1}
                </Link>
              </td>
              <td className="py-2">
                {PROPERTY_TYPES.find((t) => t.value === property.property_type)?.label ??
                  property.property_type}
              </td>
              <td className="py-2">{property.address_city ?? '—'}</td>
            </tr>
          ))}
          {properties.length === 0 && !loading ? (
            <tr>
              <td className="text-muted-foreground py-4" colSpan={3}>
                No Properties found.
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

function CreatePropertyForm({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated: () => void;
}): JSX.Element {
  const [propertyType, setPropertyType] = useState<(typeof PROPERTY_TYPES)[number]['value']>(
    'residential_single_family',
  );
  const [addressLine1, setAddressLine1] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest('/api/v1/properties', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          property_type: propertyType,
          address_line1: addressLine1,
          address_city: addressCity || undefined,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Property.');
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
        <Label htmlFor="property_type">Property type</Label>
        <select
          id="property_type"
          className="border-border w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          value={propertyType}
          onChange={(event) =>
            setPropertyType(event.target.value as (typeof PROPERTY_TYPES)[number]['value'])
          }
        >
          {PROPERTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="address_line1">Address</Label>
        <Input
          id="address_line1"
          required
          value={addressLine1}
          onChange={(event) => setAddressLine1(event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="address_city">City</Label>
        <Input
          id="address_city"
          value={addressCity}
          onChange={(event) => setAddressCity(event.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Property'}
        </Button>
      </div>
    </form>
  );
}
