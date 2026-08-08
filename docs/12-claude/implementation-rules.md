# Implementation Rules

## Claude must never

1. **Invent database tables/columns without checking domain documentation.** Every table must trace to [`03-domain/`](../03-domain/) and [`04-database/schema-overview.md`](../04-database/schema-overview.md). If a genuinely new entity is needed, propose the documentation addition first (domain doc + schema entry + any needed ADR), then implement.
2. **Change architecture without checking ADRs.** Before introducing a new technology, pattern, or infrastructure dependency, check [`11-adr/`](../11-adr/) for an existing decision. A conflicting existing ADR must be explicitly superseded (a new ADR referencing and replacing it), never silently ignored.
3. **Bypass Row Level Security.** No query path uses a service-role/RLS-bypassing connection for ordinary application logic — see [Tenant Isolation](../07-security/tenant-isolation.md) and [Authorization Security](../07-security/authorization-security.md) for the narrow, explicitly logged exceptions.
4. **Put business logic into UI components.** Presentation components render and capture input only; business rules live in the Domain layer — see [Architecture Principles](../02-architecture/architecture-principles.md).
5. **Modify unrelated modules.** A task scoped to the Jobs module does not incidentally touch Financials or Inventory code, even if a "quick fix" is tempting — file a separate task/PR instead.
6. **Delete production data.** No destructive operation (`DROP TABLE`, bulk `DELETE`, force-push equivalents) runs against Staging/Production without explicit human confirmation and the safeguards in [Disaster Recovery](../10-devops/disaster-recovery.md).
7. **Introduce dependencies without justification.** Check [Technology Stack](../02-architecture/technology-stack.md) and [Dependency Management](../08-engineering/dependency-management.md) first — a new dependency needs a stated reason that an existing one doesn't already cover.
8. **Rewrite large sections unnecessarily.** Incremental, reviewable changes only — see [Coding Standards](../08-engineering/coding-standards.md) on avoiding premature abstraction and unjustified refactors.

## Claude must always

1. Match implementation to the documented domain model, database schema, and API conventions exactly — a discrepancy is a bug in the code, the documentation, or both, and must be resolved, not left inconsistent (see [Documentation Standards](../08-engineering/documentation-standards.md)).
2. Enforce tenant isolation and Role-based authorization at both the API and database layers for any new endpoint or table — see [ADR-022](../11-adr/ADR-022-security.md).
3. Write or update tests alongside any behavior change — see [Testing Instructions](./testing-instructions.md).
4. Produce an Audit Event for any new state-changing operation — see [Audit Logging](../04-database/audit-logging.md).
5. Follow the state machines documented per entity exactly — no ad hoc status values or undocumented transitions (see e.g. [Jobs](../03-domain/jobs.md), [Invoices](../03-domain/invoices.md)).

## When a request conflicts with these rules

State the conflict explicitly and propose either (a) the documented-compliant implementation, or (b) the specific documentation change required first (with its own review), per [Claude Code Guide](./claude-code-guide.md). Never silently comply with a request that would violate tenant isolation, financial immutability, or audit completeness.

## Related documents

[Claude Code Guide](./claude-code-guide.md) · [Definition of Done](./definition-of-done.md) · [Coding Instructions](./coding-instructions.md)
