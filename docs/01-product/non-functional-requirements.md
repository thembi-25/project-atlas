# Non-Functional Requirements

## Performance

- NFR-1: API p95 response time under 400ms for read endpoints and under 800ms for write endpoints under normal load (defined as up to 500 concurrent Organizations at launch scale). See [Scalability Strategy](../02-architecture/scalability-strategy.md).
- NFR-2: The scheduling/dispatch board must render a full week view for an Organization with up to 50 Technicians in under 2 seconds on a typical broadband connection.
- NFR-3: Mobile job list and job detail views must load from local cache in under 500ms even when offline. See [Mobile PRD](../06-modules/mobile-prd.md).

## Availability & Reliability

- NFR-4: Target 99.9% monthly uptime for the web application and API once out of beta. See [Monitoring](../10-devops/monitoring.md).
- NFR-5: No single Organization's data issue (corruption, bad migration data) should be able to affect another Organization, structurally guaranteed by [Multi-Tenancy](../04-database/multi-tenancy.md) and RLS.
- NFR-6: Payment-affecting operations (invoice finalization, payment capture) must be idempotent — see [Idempotency](../05-api/api-overview.md) and [ADR-018](../11-adr/ADR-018-payments.md).

## Scalability

- NFR-7: The database and application must support at least 10,000 Organizations and 250,000 Jobs/month at launch-plus-one-year scale without an architecture change, per [Scalability Strategy](../02-architecture/scalability-strategy.md).
- NFR-8: Module boundaries in the modular monolith must allow a high-traffic module (e.g., Jobs) to be extracted into a separate service later without a data-model rewrite — see [ADR-001](../11-adr/ADR-001-monorepo.md).

## Security

- NFR-9: All tenant data isolation is enforced at the database layer via Row Level Security, never solely in application code. See [Tenant Isolation](../07-security/tenant-isolation.md).
- NFR-10: All data in transit is encrypted (TLS 1.2+); all data at rest is encrypted using the underlying infrastructure's (Supabase/Postgres, storage) encryption-at-rest. See [Data Protection](../07-security/data-protection.md).
- NFR-11: Authentication supports secure password policies and, at minimum, TOTP-based MFA for Owner/Admin roles. See [Authentication Security](../07-security/authentication-security.md).
- NFR-12: No secret (API key, database credential, signing key) is committed to source control; all secrets are managed via environment-scoped secret storage. See [Secrets Management](../07-security/secrets-management.md).

## Data Integrity & Auditability

- NFR-13: Financial records (Invoices, Payments) are immutable once finalized; corrections happen via documented reversal/adjustment entities, never destructive edits. See [Invoices](../03-domain/invoices.md).
- NFR-14: Every state-changing action on tenant data is attributable to an actor and recoverable in the Audit Event log for a minimum retention period defined in [Audit Logging](../04-database/audit-logging.md).

## Usability & Accessibility

- NFR-15: The web application meets WCAG 2.1 AA for core operational flows (scheduling, job detail, invoicing).
- NFR-16: The mobile technician experience must be fully usable one-handed in the field, with primary actions reachable within two taps from the job list.

## Compatibility

- NFR-17: The web application supports current-and-previous major versions of Chrome, Safari, Edge, and Firefox.
- NFR-18: The mobile experience supports current-and-previous-two major versions of iOS and Android (see [Mobile PRD](../06-modules/mobile-prd.md) for the specific delivery mechanism — responsive web app at launch, native app evaluated post-launch).

## Maintainability

- NFR-19: All code adheres to [Coding Standards](../08-engineering/coding-standards.md) and [TypeScript Standards](../08-engineering/typescript-standards.md); TypeScript strict mode is non-negotiable.
- NFR-20: No module may be modified without corresponding test coverage per [Testing Strategy](../09-testing/testing-strategy.md).

## Observability

- NFR-21: All API requests are logged with a correlation ID traceable end-to-end; all errors are captured with enough context to reproduce without exposing tenant PII in logs. See [Logging](../10-devops/logging.md).

## Compliance (launch scope)

- NFR-22: Payment card data is never stored directly by Atlas; PCI scope is minimized via a tokenizing payment processor (see [ADR-018](../11-adr/ADR-018-payments.md)).
- NFR-23: Customer PII handling follows the data classification and retention rules in [Data Protection](../07-security/data-protection.md).
