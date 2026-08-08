# Security Architecture

## Purpose

This is the top-level security document; it maps Atlas's threat surface to the specific controls documented in this directory. Every claim below is backed by a concrete mechanism, not a general assurance — per the documentation quality bar in the project brief ("what is protected, from whom, how, where enforcement occurs").

## What is protected

| Asset | From whom | How | Where enforced |
|---|---|---|---|
| Tenant business data (Customers, Properties, Jobs, financial records) | Other Organizations on the platform; compromised/malicious application code | PostgreSQL Row Level Security, membership-checked | Database layer — [Tenant Isolation](./tenant-isolation.md) |
| Tenant business data | Unauthorized Roles within the same Organization | RBAC Permission checks | API layer — [Authorization](../05-api/authorization.md) |
| Customer PII (contact info, addresses) | External attackers, credential theft | Encryption in transit (TLS), encryption at rest (Supabase/Postgres), least-privilege data access | [Data Protection](./data-protection.md) |
| Payment card data | Everyone, including Atlas itself | Never stored — tokenized via Stripe | [Data Protection](./data-protection.md), [ADR-018](../11-adr/ADR-018-payments.md) |
| User accounts | Credential stuffing, brute force, session hijacking | Secure password policy, MFA for privileged Roles, `httpOnly` session cookies, rate limiting | [Authentication Security](./authentication-security.md) |
| API surface | Injection, malformed input, abuse | Zod validation, parameterized queries (Drizzle), rate limiting | [API Security](./api-security.md) |
| Secrets (DB credentials, API keys, signing keys) | Source control exposure, runtime leakage | Environment-scoped secret storage, never committed | [Secrets Management](./secrets-management.md) |
| Historical record integrity | Insider tampering, accidental deletion | Append-only, trigger-enforced Audit Events; no `UPDATE`/`DELETE` grant on the audit table | [Audit Security](./audit-security.md) |

## Defense in depth, concretely

Atlas's security model is explicitly layered so that no single control's failure is catastrophic:

1. **Network**: TLS everywhere; no component other than the app and Worker holds direct database credentials (see [Deployment Architecture](../02-architecture/deployment-architecture.md)).
2. **Authentication**: Supabase Auth-issued, verified JWTs; MFA for privileged Roles.
3. **Authorization (API layer)**: Role/Permission checks before any database work.
4. **Authorization (database layer)**: Row Level Security, independent of the API layer — see [Tenant Isolation](./tenant-isolation.md).
5. **Data integrity**: foreign keys, check constraints, triggers enforcing business rules the application must not be the sole guardian of.
6. **Observability**: every state change is audited; every request is traceable.

A failure at any one layer (a bug in a route handler's permission check, for instance) is still contained by the layers below it.

## Threat model summary

See [Threat Model](./threat-model.md) for the full STRIDE-style analysis. The highest-priority threats given Atlas's data (multi-tenant SMB operational + financial + PII data) are: cross-tenant data leakage, account takeover, and payment fraud — each has a dedicated document in this directory.

## Security review cadence

Every PR touching authentication, authorization, RLS policies, or payment code requires the checklist in [Security Testing](../09-testing/security-testing.md) to pass before merge — this is a release gate, not a suggestion, per [Acceptance Criteria](../01-product/acceptance-criteria.md).

## Related documents

[Tenant Isolation](./tenant-isolation.md) · [Authentication Security](./authentication-security.md) · [Authorization Security](./authorization-security.md) · [Data Protection](./data-protection.md) · [Threat Model](./threat-model.md)
