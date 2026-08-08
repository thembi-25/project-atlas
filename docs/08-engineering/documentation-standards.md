# Documentation Standards

## This directory (`docs/`) is authoritative

Code implements what's documented in [`docs/`](../README.md); it does not define behavior that then gets documented after the fact as an afterthought. When implementation reveals that a documented decision was wrong or incomplete, the documentation is updated **in the same PR** as the code change — a PR that changes behavior without updating the corresponding PRD/domain doc/ADR is incomplete. See [Documentation Instructions](../12-claude/documentation-instructions.md).

## Format requirements

- Markdown, GitHub-flavored, one `.md` file per topic matching the structure in [`docs/README.md`](../README.md).
- Cross-references use relative Markdown links (`[Property Domain](../03-domain/properties.md)`), never absolute URLs or bare filenames — see [Documentation Dependencies](../README.md#document-conventions).
- Diagrams use Mermaid, embedded directly in the Markdown, and only where they communicate real structure/flow — not decoratively.
- Terminology matches [`00-overview/terminology.md`](../00-overview/terminology.md) exactly; a new business term is added there before it's used elsewhere.

## PRD and ADR templates are fixed

Every file in [`06-modules/`](../06-modules/) follows the 20-section PRD template; every file in [`11-adr/`](../11-adr/) follows the standard ADR template (Status, Date, Context, Problem, Decision, Alternatives Considered, Consequences, Risks, Migration/Rollback, Related Decisions). A new module PRD or ADR that omits a section is incomplete, not "using a lighter template."

## When to write an ADR vs. just update a doc

An ADR is written for a decision that is expensive to reverse or establishes a pattern other modules will follow (see [Architecture Principles](../02-architecture/architecture-principles.md), principle 7). A decision that's easily changed later, or is purely an implementation detail of one module, is documented in that module's own PRD/domain doc, not elevated to an ADR — see [ADR-001](../11-adr/ADR-001-monorepo.md) for the bar.

## Consistency review discipline

Any PR that adds or changes a domain concept, database table, or API convention checks for and fixes any now-inconsistent references elsewhere in `docs/` — the same discipline exercised in the initial [`DOCUMENTATION-CONSISTENCY-REPORT.md`](../DOCUMENTATION-CONSISTENCY-REPORT.md) audit applies continuously, not just once at project start.

## No speculative/placeholder documentation

A section that doesn't yet have a real answer is marked as an explicit open question (see the pattern in [`DOCUMENTATION-CONSISTENCY-REPORT.md`](../DOCUMENTATION-CONSISTENCY-REPORT.md)) rather than filled with generic, non-committal language — "TBD, needs business input" is more useful and more honest than a vague paragraph that sounds decided but isn't.

## Related documents

[`docs/README.md`](../README.md) · [Documentation Instructions](../12-claude/documentation-instructions.md) · [Terminology](../00-overview/terminology.md)
