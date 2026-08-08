# Security Instructions

## The highest-stakes rule

Tenant isolation is never compromised for convenience, speed, or a "just this once" exception. Any code path that could theoretically expose one Organization's data to another is treated as a blocking issue, not a follow-up ticket. See [Tenant Isolation](../07-security/tenant-isolation.md).

## For any change touching authentication, authorization, RLS, or payments

The [Security Testing](../09-testing/security-testing.md) checklist must pass before the change is considered complete — this is not optional review, it's a release gate per [Acceptance Criteria](../01-product/acceptance-criteria.md).

## Specific rules

1. **Never trust client-supplied tenant/role context.** `organization_id`, Role, and Permission are always resolved server-side from the authenticated session's live Membership state — see [Authorization Security](../07-security/authorization-security.md).
2. **Never construct SQL from string concatenation of request input.** Drizzle's parameterized query builder only.
3. **Never store secrets in code, logs, or committed files.** See [Secrets Management](../07-security/secrets-management.md) — if you encounter a secret in a place it shouldn't be, flag it and do not propagate it further (e.g., don't echo it in a commit message or log line).
4. **Never store payment card data.** Card capture is always via Stripe's client-side tokenization — see [ADR-018](../11-adr/ADR-018-payments.md).
5. **Never weaken an existing RLS policy without understanding why it was written that way** — check [Tenant Isolation](../07-security/tenant-isolation.md) and the relevant table's migration history before modifying a policy.
6. **Never suppress or bypass the audit trigger** for a table, even temporarily for a migration/backfill — see [Audit Logging](../04-database/audit-logging.md).

## When adding a new endpoint or table

Confirm both layers of authorization are in place — API-layer Permission check AND database-layer RLS policy — per [ADR-022](../11-adr/ADR-022-security.md). Neither alone is sufficient.

## If you discover a security issue while working on something else

Do not silently fix it as a drive-by change to an unrelated PR (this violates the "don't modify unrelated modules" rule in [Implementation Rules](./implementation-rules.md) and could hide a serious finding in an unrelated diff) — flag it explicitly, and either open a dedicated, clearly-labeled fix or escalate to the user/team depending on severity.

## Related documents

[Security Architecture](../07-security/security-architecture.md) · [Tenant Isolation](../07-security/tenant-isolation.md) · [Security Testing](../09-testing/security-testing.md) · [Implementation Rules](./implementation-rules.md)
