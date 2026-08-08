# Threat Model

## Scope

A STRIDE-style threat model for Project Atlas at launch scope (Phase 1–2 — see [Product Scope](../01-product/product-scope.md)), covering the modular monolith, PostgreSQL/Supabase data platform, and third-party integrations described in [Architecture Overview](../02-architecture/architecture-overview.md).

## Assets being protected

Tenant business data (Customers, Properties, Jobs, financial records), Customer PII, payment flows (not card data itself, which is never stored), platform availability, and Atlas's own reputation for data trustworthiness — which is core to the entire product thesis (see [Product Principles](../00-overview/product-principles.md)).

## Threats and mitigations

| STRIDE category | Concrete threat | Mitigation | Detail |
|---|---|---|---|
| **Spoofing** | Attacker impersonates a User via stolen credentials | Secure password policy, MFA for privileged Roles, breach-checked passwords, anomaly alerts | [Authentication Security](./authentication-security.md) |
| **Spoofing** | Forged webhook claiming to be from Stripe/Twilio | Signature verification before any processing | [Webhooks](../05-api/webhooks.md) |
| **Tampering** | A User modifies another Organization's data via a crafted request | RLS enforced independently of API-layer checks | [Tenant Isolation](./tenant-isolation.md) |
| **Tampering** | A finalized Invoice is altered to hide fraud | Database-trigger-enforced immutability on finalized Invoices | [Constraints](../04-database/constraints.md), [Invoices](../03-domain/invoices.md) |
| **Tampering** | Audit trail is altered to cover up an action | No `UPDATE`/`DELETE` grant on `audit_events` for any application-reachable role | [Audit Security](./audit-security.md) |
| **Repudiation** | A staff member denies performing an action (e.g., a discount, a void) | Every state-changing action is attributed and logged synchronously | [Audit Events](../03-domain/audit-events.md) |
| **Information Disclosure** | Cross-tenant data leak via a buggy endpoint | RLS as an independent enforcement layer; UUID (non-enumerable) IDs; `404` (not `403`) on cross-tenant access | [Tenant Isolation](./tenant-isolation.md) |
| **Information Disclosure** | Payment card data exposure | Card data never touches Atlas's systems — tokenized via Stripe | [ADR-018](../11-adr/ADR-018-payments.md) |
| **Information Disclosure** | Sensitive data leaked via logs/error messages | Log redaction of secret/PII-shaped fields; generic `500` error bodies | [Logging](../10-devops/logging.md), [Errors](../05-api/errors.md) |
| **Denial of Service** | Abusive/runaway client degrades service for others | Per-session/Organization/IP rate limiting | [Rate Limiting](../05-api/rate-limiting.md) |
| **Denial of Service** | One Organization's data volume degrades another's query performance | Per-Organization query monitoring; indexing/partitioning before infrastructure isolation | [Scalability Strategy](../02-architecture/scalability-strategy.md) |
| **Elevation of Privilege** | A Technician-level account gains Admin-level access via a crafted request | Server-side, live-Membership-state Role resolution; no client-supplied Role trusted | [Authorization Security](./authorization-security.md) |
| **Elevation of Privilege** | A compromised third-party integration credential is used to exceed its intended scope | API keys scoped to specific Permissions no broader than the issuing User's own access | [Integrations](../05-api/integrations.md) |

## Highest-priority residual risks (require ongoing vigilance, not one-time fixes)

1. **Cross-tenant data leakage from a new feature's incomplete RLS policy** — mitigated by the mandatory RLS-in-same-migration rule ([Migrations](../04-database/migrations.md)) and CI-enforced isolation tests, but any new table is a fresh opportunity for a mistake.
2. **Insider risk from a User with legitimately broad access (Owner/Admin) acting maliciously** — mitigated by the immutable Audit trail providing after-the-fact accountability, since prevention alone can't fully address a legitimately-privileged actor.
3. **Third-party integration compromise** (Stripe, Twilio, Supabase Auth itself) — outside Atlas's direct control; mitigated by minimizing what each integration can access (least privilege per integration) and monitoring for anomalous activity.

## Out of scope for this threat model

Physical security of Supabase/Vercel infrastructure (delegated to those providers' own security programs and compliance certifications); social engineering of Atlas's own employees (covered by internal security practices, not product architecture).

## Related documents

[Security Architecture](./security-architecture.md) · [Tenant Isolation](./tenant-isolation.md) · [Security Testing](../09-testing/security-testing.md)
