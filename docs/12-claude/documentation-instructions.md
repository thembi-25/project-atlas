# Documentation Instructions

## Documentation and code stay in sync, always

If implementation reveals that a documented decision was incomplete, wrong, or needs refinement, update the relevant document(s) **in the same PR** as the code change — see [Documentation Standards](../08-engineering/documentation-standards.md). A PR that changes behavior without updating the corresponding PRD, domain doc, or ADR is incomplete, not "documentation debt for later."

## Before creating a new document

Check whether an existing document already covers the topic — extend it rather than creating a near-duplicate. New module PRDs, domain docs, and ADRs follow their fixed templates exactly (20 sections for PRDs, the standard ADR template — see [Documentation Standards](../08-engineering/documentation-standards.md)).

## When to write a new ADR vs. update an existing document

Write a new ADR for a decision that's expensive to reverse or establishes a pattern other modules will follow. Update an existing domain doc/PRD for anything else (implementation detail, scoped-to-one-module decision). See [Documentation Standards](../08-engineering/documentation-standards.md) and the bar set in [ADR-001](../11-adr/ADR-001-monorepo.md).

## Never write a superseding ADR without linking it

If a new decision changes or reverses a previous ADR, the new ADR's "Related Decisions" section links to and explicitly states it supersedes the old one; the old ADR's Status is updated to `Superseded by ADR-0XX` — the old ADR is never silently deleted or left looking still-current.

## Terminology discipline

Use terms exactly as defined in [Terminology](../00-overview/terminology.md). If a new business concept needs a name, add it to Terminology in the same PR that introduces it elsewhere.

## Cross-references

Use relative Markdown links, matching the existing link style throughout `docs/`. When you add a new document, add reciprocal links from the documents that should reference it (e.g., a new domain entity should be linked from [Domain Overview](../03-domain/domain-overview.md) and any PRD/ADR that depends on it).

## No placeholder documentation

If a section doesn't yet have a real, considered answer, mark it as an explicit open question (see the pattern in [`DOCUMENTATION-CONSISTENCY-REPORT.md`](../DOCUMENTATION-CONSISTENCY-REPORT.md)) rather than writing generic filler that reads as decided but isn't.

## Related documents

[Documentation Standards](../08-engineering/documentation-standards.md) · [Terminology](../00-overview/terminology.md) · [`docs/README.md`](../README.md)
