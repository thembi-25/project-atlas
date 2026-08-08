# Code Review

## What reviewers check, in priority order

1. **Correctness against the domain model**: does this match [`03-domain/`](../03-domain/) and the relevant [PRD](../06-modules/)? A reviewer who spots a divergence (e.g., code allowing an Invoice edit after finalization) blocks the PR regardless of how well-tested the divergent behavior is — the documentation is the source of truth, not the code being reviewed.
2. **Tenant isolation and permission correctness**: does every new query/endpoint respect RLS and Role-based [Authorization](../05-api/authorization.md)? This is checked even on PRs that aren't "security PRs," since isolation bugs are usually introduced incidentally, not by someone deliberately weakening security.
3. **Correctness of business rules and edge cases**: state machine transitions, immutability rules, audit requirements — cross-checked against the relevant domain document's "Business Rules" section.
4. **Test coverage and quality**: do the tests actually exercise the stated behavior, including the failure/edge cases documented in the relevant PRD's sections 16–17?
5. **Code quality**: readability, adherence to [Coding Standards](./coding-standards.md)/[TypeScript Standards](./typescript-standards.md), no unjustified `any`, no premature abstraction.
6. **Simplicity**: could this be simpler? Per the engineering philosophy, three similar lines beat a premature abstraction — a reviewer should push back on over-engineering as readily as under-engineering.

## What reviewers do NOT block on

- Stylistic preferences already covered by Prettier/ESLint (the tools are the source of truth for formatting, not reviewer taste).
- Scope the PR explicitly and reasonably excluded (tracked as a follow-up rather than demanded inline), unless the exclusion creates a genuine correctness gap.

## Review tone and turnaround

Reviews focus on the code, not the author; comments explain *why* a change is requested, referencing the specific documentation section where applicable, so the author can verify the reasoning rather than take it on faith. Target turnaround: within one business day for an initial review pass, given the small-team velocity Atlas is built for at this stage.

## Self-review

Authors review their own diff before requesting review (catching obvious issues, leftover debug code, or accidental unrelated changes) — this is expected, not optional, and keeps reviewer time focused on substance.

## Related documents

[Pull Request Process](./pull-request-process.md) · [Coding Standards](./coding-standards.md) · [Definition of Done](../12-claude/definition-of-done.md)
