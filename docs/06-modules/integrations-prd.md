# Integrations — PRD

## 1. Purpose

Manage Organization-level connections to external systems — at launch, primarily QuickBooks Online accounting sync — and the general integration-connection framework future integrations build on. See [Integration Architecture](../02-architecture/integration-architecture.md).

## 2. Business problem

Businesses currently re-key Invoice/Payment data into their accounting software by hand, a recurring, error-prone task that a direct sync eliminates.

## 3. Goals

- One-click OAuth connection to QuickBooks Online per Organization.
- Reliable, idempotent sync of finalized Invoices and Payments.
- A general connection framework that a future integration (Xero, Marketplace partners) can reuse rather than each building bespoke plumbing.

## 4. Non-goals

- Two-way sync that lets accounting-software edits flow back and alter Atlas's Invoices — Atlas's Invoices remain the immutable source of truth (see [Invoices](../03-domain/invoices.md)); QuickBooks sync is one-directional (Atlas → QuickBooks) at launch.

## 5. Personas

[Priya (Accountant)](../00-overview/user-personas.md).

## 6. User stories

As an Accountant, I want finalized Invoices to appear in QuickBooks automatically, so I don't have to re-enter them before running payroll/tax reports.

## 7. Functional requirements

OAuth connect/disconnect flow per Organization; scheduled + on-demand sync of finalized Invoices and completed Payments; sync-status/error visibility.

## 8. Business rules

Sync is triggered by the same `invoice.finalized`/`payment.received` domain events used for Notifications (see [Event-Driven Architecture](../02-architecture/event-driven-architecture.md)), processed by the Worker, never inline in the request path. A sync failure never blocks or reverses the underlying Atlas Invoice/Payment — Atlas's own record is always authoritative regardless of sync state.

## 9. State machines

Sync record status: `pending → synced/failed` per Invoice/Payment, retried per [Integration Architecture](../02-architecture/integration-architecture.md) resilience patterns.

## 10. Data requirements

`integration_connections` (`organization_id`, `provider`, OAuth token references — encrypted at rest, see [Secrets Management](../07-security/secrets-management.md)), `sync_records` (`organization_id`, `provider`, `entity_type`, `entity_id`, `status`, `last_attempted_at`, `error_detail`).

## 11. API requirements

`POST /api/v1/integrations/quickbooks/connect` (OAuth redirect flow), `DELETE /api/v1/integrations/quickbooks`, `GET /api/v1/integrations/quickbooks/sync-status`.

## 12. Permission requirements

Admin/Owner only — connecting an accounting integration exposes financial data to a third party and is treated as a high-privilege action.

## 13. UI requirements

Settings → Integrations page with connect/disconnect and sync-status/error visibility; manual "retry sync" action for failed items.

## 14. Notifications

Sync failure alert to Admin/Owner (in-app + email) when an Invoice/Payment repeatedly fails to sync after retries.

## 15. Audit requirements

Connection/disconnection and every sync attempt produce [Audit Events](../03-domain/audit-events.md) — connecting financial data to an external system is treated with the same sensitivity as a Payment action.

## 16. Error cases

Expired/revoked QuickBooks OAuth token (sync marked `failed` with a clear reconnect prompt, not a silent repeated failure); a QuickBooks-side validation rejection (e.g., a Customer name conflict) surfaced with the provider's specific error detail to the Accountant.

## 17. Edge cases

An Organization disconnects QuickBooks mid-sync-backlog — in-flight sync jobs are cancelled cleanly; already-synced records remain synced (no rollback), and reconnecting later resumes only for records created/changed since disconnection, not a full historical re-sync by default (a full re-sync is available as an explicit, deliberate action).

## 18. Acceptance criteria

**Given** a connected QuickBooks integration, **when** an Invoice is finalized, **then** it appears in QuickBooks within the scheduled sync window (or immediately via on-demand sync), matching Atlas's line items and total exactly.

## 19. Testing requirements

OAuth flow integration tests (using QuickBooks sandbox); idempotent-sync tests (a redelivered/retried sync never creates a duplicate QuickBooks record); disconnect/reconnect resume-behavior tests.

## 20. Future extensions

Xero and other accounting platform support; outbound webhook framework for third-party/Marketplace/Manufacturer integrations (see [Webhooks](../05-api/webhooks.md), Outbound webhooks); Zapier-style automation platform connection.
