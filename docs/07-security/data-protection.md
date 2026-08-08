# Data Protection

## Data classification

| Class | Examples | Handling |
|---|---|---|
| **Restricted** | Payment card data | Never stored by Atlas at all — tokenized via Stripe (see [ADR-018](../11-adr/ADR-018-payments.md)) |
| **Confidential** | Customer PII (name, address, phone, email), User credentials | Encrypted in transit and at rest; access RLS- and Role-scoped; never logged in plaintext (see [Logging](../10-devops/logging.md)) |
| **Internal** | Job notes, pricing, Inventory costs | RLS- and Role-scoped; not customer-portal-visible where cost-sensitive |
| **Public-ish (within tenant)** | Job Types, Asset Types, checklist templates | Visible to all Roles within an Organization; platform-default subset shared across Organizations (see [Seed Data](../04-database/seed-data.md)) |

## Encryption

- **In transit**: TLS 1.2+ enforced for all client-server and server-to-third-party traffic; no plaintext HTTP path exists in any environment, including local development against remote services.
- **At rest**: provided by the underlying infrastructure — Supabase's managed PostgreSQL encrypts data at rest by default; Supabase Storage similarly encrypts stored files at rest. Atlas does not additionally hand-roll application-level encryption for standard fields, avoiding key-management complexity that infrastructure-level encryption already solves — see [Non-Functional Requirements](../01-product/non-functional-requirements.md), NFR-10.

## Secure file handling

- Uploads are validated for MIME type and size **before** a Storage signed URL is issued (see [Request Validation](../05-api/request-validation.md)) — Atlas does not trust the client-reported content type alone; the Worker performs a server-side content-type sniff on receipt for defense in depth.
- Files are served via short-lived, scoped signed URLs, never long-lived public URLs, even for content that seems low-sensitivity (a job photo can still reveal a customer's address/property details).
- Uploaded files are scanned for malware where the underlying Storage/infrastructure provider offers it; execution of uploaded content is never possible (Storage-only, never served as executable application code).

## PII minimization

- Only PII genuinely needed for the operational relationship is collected — no speculative "might be useful later" fields on Customer/Contact records.
- Staff-only fields (access notes, internal tags) are never exposed on Customer Portal-facing endpoints (see [Customer Portal PRD](../06-modules/customer-portal-prd.md), output validation).

## Data subject rights (deletion/export requests)

- A Customer/Contact data deletion request is handled via the [Soft Deletion](../04-database/soft-deletion.md) mechanism plus, where a genuine erasure obligation applies and no financial/audit retention requirement overrides it (see [Audit Logging](../04-database/audit-logging.md) retention minimums), a deliberate, logged hard-purge process — never an ad hoc manual `DELETE`.
- An Organization can export all of its own data at any time via the standard API/[Reporting](../06-modules/reporting-prd.md) mechanisms — see [Product Principles](../00-overview/product-principles.md), principle 9.

## Related documents

[Secrets Management](./secrets-management.md) · [Soft Deletion](../04-database/soft-deletion.md) · [ADR-018: Payments](../11-adr/ADR-018-payments.md) · [Backups](../10-devops/backups.md)
