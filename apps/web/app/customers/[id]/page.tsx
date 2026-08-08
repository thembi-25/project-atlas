'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button, Input, Label } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { ContactDto, CustomerDto } from '@/lib/crm-types';

/**
 * Customer detail page — customers-prd.md §13: "Customer detail page with
 * Properties/Contacts/Jobs/Financials tabs." Properties/Jobs/Financials
 * tabs are not implemented — those modules don't exist yet this sprint
 * (see SPRINT-2-COMPLETION-REPORT.md, "Known Limitations"); only the
 * Contacts tab, which is this sprint's own domain, is built.
 */
export default function CustomerDetailPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <CustomerDetailPageContent />
    </Suspense>
  );
}

function CustomerDetailPageContent(): JSX.Element {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [customer, setCustomer] = useState<CustomerDto | null>(null);
  const [contacts, setContacts] = useState<ContactDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setError(null);
    try {
      const qs = new URLSearchParams({ organization_id: organizationId });
      const [customerResult, contactsResult] = await Promise.all([
        apiRequest<CustomerDto>(`/api/v1/customers/${params.id}?${qs.toString()}`),
        apiRequest<ContactDto[]>(`/api/v1/customers/${params.id}/contacts?${qs.toString()}`),
      ]);
      setCustomer(customerResult.data);
      setContacts(contactsResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Customer.');
    }
  }, [organizationId, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const archive = async () => {
    if (!organizationId || !customer) return;
    if (!confirm(`Archive ${customer.display_name}?`)) return;
    try {
      await apiRequest(`/api/v1/customers/${customer.id}?organization_id=${organizationId}`, {
        method: 'DELETE',
      });
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive Customer.');
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

  if (!customer) {
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
          <h1 className="text-2xl font-semibold">{customer.display_name}</h1>
          <p className="text-muted-foreground text-sm capitalize">
            {customer.type}
            {customer.deleted_at ? ' · archived' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Cancel' : 'Edit'}
          </Button>
          {!customer.deleted_at ? (
            <Button variant="destructive" onClick={() => void archive()}>
              Archive
            </Button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <EditCustomerForm
          customer={customer}
          organizationId={organizationId}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      ) : (
        <dl className="mb-8 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Billing address</dt>
          <dd>
            {[
              customer.billing_address_line1,
              customer.billing_address_city,
              customer.billing_address_region,
              customer.billing_address_postal_code,
            ]
              .filter(Boolean)
              .join(', ') || '—'}
          </dd>
          <dt className="text-muted-foreground">Tags</dt>
          <dd>{customer.tags.length > 0 ? customer.tags.join(', ') : '—'}</dd>
          <dt className="text-muted-foreground">Notes</dt>
          <dd>{customer.notes ?? '—'}</dd>
        </dl>
      )}

      <h2 className="mb-3 text-lg font-semibold">Contacts</h2>
      <ul className="divide-border border-border mb-4 divide-y rounded-md border">
        {contacts.map((contact) => (
          <li key={contact.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <div>
              <span className="font-medium">{contact.name}</span>
              {contact.is_primary ? (
                <span className="bg-muted text-muted-foreground ml-2 rounded px-1.5 py-0.5 text-xs">
                  Primary
                </span>
              ) : null}
              <div className="text-muted-foreground">
                {[contact.phone, contact.email].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
          </li>
        ))}
        {contacts.length === 0 ? (
          <li className="text-muted-foreground px-4 py-2 text-sm">No Contacts.</li>
        ) : null}
      </ul>

      <AddContactForm
        customerId={customer.id}
        organizationId={organizationId}
        onAdded={() => void load()}
      />
    </main>
  );
}

function EditCustomerForm({
  customer,
  organizationId,
  onSaved,
}: {
  customer: CustomerDto;
  organizationId: string;
  onSaved: () => void;
}): JSX.Element {
  const [displayName, setDisplayName] = useState(customer.display_name);
  const [notes, setNotes] = useState(customer.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/customers/${customer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          organization_id: organizationId,
          display_name: displayName,
          notes: notes || null,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update Customer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="border-border mb-8 flex flex-col gap-3 rounded-md border p-4"
    >
      <div>
        <Label htmlFor="edit_display_name">Name</Label>
        <Input
          id="edit_display_name"
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="edit_notes">Notes</Label>
        <Input id="edit_notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

function AddContactForm({
  customerId,
  organizationId,
  onAdded,
}: {
  customerId: string;
  organizationId: string;
  onAdded: () => void;
}): JSX.Element {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/customers/${customerId}/contacts`, {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          name,
          phone: phone || undefined,
          email: email || undefined,
        }),
      });
      setName('');
      setPhone('');
      setEmail('');
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add Contact.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="border-border flex flex-col gap-3 rounded-md border p-4">
      <p className="text-sm font-medium">Add a Contact</p>
      <div className="flex gap-3">
        <div className="flex-1">
          <Label htmlFor="contact_name">Name</Label>
          <Input
            id="contact_name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="contact_phone">Phone</Label>
          <Input
            id="contact_phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="contact_email">Email</Label>
          <Input
            id="contact_email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add Contact'}
        </Button>
      </div>
    </form>
  );
}
