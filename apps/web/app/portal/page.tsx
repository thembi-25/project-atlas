'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';

interface PortalContactDto {
  id: string;
  organization_id: string;
  customer_id: string;
  name: string;
}

/**
 * Customer Portal landing page — customer-portal-prd.md. Deliberately
 * minimal: no Properties/Jobs browsing or Estimate/Invoice listing (out
 * of Sprint 5's confirmed scope — see docs/13-roadmap/sprint-5.md,
 * "Scope decisions"). A Contact reaches a specific Estimate/Invoice via a
 * direct link (emailed once Notifications, Sprint 7, exists); this page
 * only confirms the session and which Customer(s) it's linked to.
 */
export default function PortalHomePage(): JSX.Element {
  const [contacts, setContacts] = useState<PortalContactDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<PortalContactDto[]>('/api/v1/portal/me')
      .then((result) => setContacts(result.data))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load Portal session.'),
      );
  }, []);

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="mb-4 text-2xl font-semibold">Your Portal</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {contacts && contacts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">Signed in as a Contact for:</p>
          <ul className="flex flex-col gap-1 text-sm">
            {contacts.map((contact) => (
              <li key={contact.id} className="border-border rounded-md border p-3">
                {contact.name}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-4 text-sm">
            Estimate and Invoice links are sent directly to your email — open one from there to
            review and approve, or pay.
          </p>
        </div>
      ) : null}
      {contacts && contacts.length === 0 ? (
        <p className="text-muted-foreground text-sm">No linked Customer accounts found.</p>
      ) : null}
    </main>
  );
}
