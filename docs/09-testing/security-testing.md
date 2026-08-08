# Security Testing

## The release-blocking checklist

Every PR touching authentication, authorization, RLS policies, or payment code must pass this checklist before merge (see [Pull Request Process](../08-engineering/pull-request-process.md)); every release additionally re-runs the full checklist against the release candidate:

1. **Tenant isolation**: automated cross-tenant tests pass for every tenant-owned table touched (see [Database Testing](./database-testing.md)).
2. **Authorization matrix**: every Role's expected access to the changed endpoint(s) is explicitly tested (can and cannot), matching the relevant PRD's "Permission Requirements" section.
3. **No new `any`/unvalidated input path**: request validation (see [Request Validation](../05-api/request-validation.md)) covers every new field.
4. **No secret exposure**: no new logging statement, error message, or response field leaks a secret or internal-only data — spot-checked in review, backed by automated log-redaction tests (see [Secrets Management](../07-security/secrets-management.md)).
5. **Injection surface**: no raw SQL string interpolation from request input (structurally prevented by Drizzle, verified by lint rule — see [API Security](../07-security/api-security.md)).
6. **Idempotency**: if the change touches a payment-affecting operation, idempotency is tested (see [API Testing](./api-testing.md)).

## Automated security scanning

- Dependency vulnerability scanning on every PR and daily against `main` (see [Dependency Management](../08-engineering/dependency-management.md)).
- Static analysis (ESLint security-focused rules, e.g., detecting `dangerouslySetInnerHTML` usage or missing `await` on authorization checks) runs as part of standard linting, not a separate opt-in step.

## Periodic, broader security review

- Quarterly RLS policy audit (see [Tenant Isolation](../07-security/tenant-isolation.md)) reviewing every policy for both correctness and unintended overlap/gaps.
- Pre-launch (and periodically thereafter, as scope grows) external penetration test against a Staging-equivalent environment, scoped to the threats in [Threat Model](../07-security/threat-model.md) — a specific, budgeted activity tracked as an open item until scheduled (see [`DOCUMENTATION-CONSISTENCY-REPORT.md`](../DOCUMENTATION-CONSISTENCY-REPORT.md)).

## Incident-simulation testing

A tabletop exercise (not purely automated) walking through the [Disaster Recovery](../10-devops/disaster-recovery.md) plan for a plausible security incident (e.g., a leaked API key, a suspected RLS gap discovered in Production) — conducted before launch and revisited periodically, so the response procedure is practiced rather than theoretical.

## What automated security testing does NOT replace

Human code review judgment on business-logic-level authorization nuance (e.g., "should a Dispatcher really be able to see this specific field") — automated tests verify the *documented* Permission model is correctly implemented; whether that model itself is correct is a product/security review question, not something a test suite can catch on its own.

## Related documents

[Security Architecture](../07-security/security-architecture.md) · [Threat Model](../07-security/threat-model.md) · [Database Testing](./database-testing.md) · [Definition of Done](../12-claude/definition-of-done.md)
