# Definition of Done

A task — feature, bug fix, or documentation change — is done only when **every** applicable item below is true. This is the actual completion bar; "the code compiles and looks right" is not sufficient.

## Correctness

- [ ] Implementation matches the relevant PRD's Functional Requirements and Business Rules exactly.
- [ ] Every documented state machine transition (valid and invalid) behaves as specified.
- [ ] Every documented error case and edge case (PRD sections 16–17) is handled as specified.

## Data layer

- [ ] Any new tenant-owned table has RLS enabled, forced, and policy-covered in the same migration.
- [ ] Any new table follows [Naming Conventions](../04-database/naming-conventions.md), [Primary Keys](../04-database/primary-keys.md), [Foreign Keys](../04-database/foreign-keys.md).
- [ ] Migration is additive-first/backward-compatible per [Migrations](../04-database/migrations.md), and tested against realistic data volume.

## Security

- [ ] Both API-layer Permission checks and database-layer RLS are in place for any new endpoint/table.
- [ ] No secret, card data, or unredacted PII appears in code, logs, or committed files.
- [ ] The [Security Testing](../09-testing/security-testing.md) checklist passes, if the change touches auth/authorization/RLS/payments.

## Audit

- [ ] Every new state-changing operation produces exactly one Audit Event, verified by a test.

## Tests

- [ ] Unit tests for new Domain-layer logic.
- [ ] Integration tests for new database/RLS-touching behavior, including a cross-tenant isolation test for any new tenant-owned table.
- [ ] API tests for any new/changed endpoint (success, validation failure, permission denial).
- [ ] All existing tests still pass — no regression.

## Code quality

- [ ] Lint and type-check pass with no suppressions beyond justified, commented exceptions.
- [ ] No business logic in Presentation-layer components.
- [ ] No unjustified new dependency.
- [ ] Scope matches what was described before implementation — no unrelated modules touched.

## Documentation

- [ ] Any behavior change is reflected in the relevant PRD/domain doc/ADR in the same PR.
- [ ] New business terms are added to [Terminology](../00-overview/terminology.md).
- [ ] Cross-references (relative links) are added/updated as needed.

## Reporting

- [ ] Files changed are listed, grouped by module/layer.
- [ ] Tests executed and their outcome are reported.
- [ ] Remaining risks or open questions are explicitly stated, not omitted.

## Release-level Definition of Done (see also [Acceptance Criteria](../01-product/acceptance-criteria.md))

Beyond a single task, a Roadmap Phase (see [Implementation Roadmap](../13-roadmap/implementation-roadmap.md)) is not considered complete until every module in that phase independently satisfies this checklist and the phase's own success metrics ([Success Metrics](../01-product/success-metrics.md)) are instrumented and reportable.
