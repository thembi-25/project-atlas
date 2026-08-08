# Bug Fixing Workflow

## 1. Reproduce and confirm the actual bug

Before changing anything, reproduce the reported behavior and identify the specific documented expectation it violates — cite the relevant PRD's Functional Requirements/Business Rules or the domain document's Business Rules that the current behavior contradicts. If the "bug" is actually a case where documentation and behavior both need reconsidering, say so rather than assuming the code is wrong.

## 2. Identify root cause, not just the symptom

Per the project's general engineering instructions: fix underlying issues rather than adding a workaround. If a Job can transition to an invalid status, find why the state-machine guard failed, don't just add a check at the one call site where the bug was observed — check whether the guard is missing at the Domain layer (see [Architecture Principles](../02-architecture/architecture-principles.md)) where it should be enforced once, for every caller.

## 3. Check for the same class of bug elsewhere

If the bug is a missing tenant-isolation check, a missing Audit Event, or a missing test for a state transition, check whether the same gap exists in sibling endpoints/modules — a bug found once is often a pattern, not an isolated mistake. Fix the pattern's root cause if reasonably scoped; otherwise, file it explicitly as a follow-up rather than silently leaving it.

## 4. Write a regression test first

Confirm the test fails against the current (buggy) code, then fix the code and confirm the test passes — per [Testing Instructions](./testing-instructions.md). A bug fix without a regression test is not considered complete.

## 5. Scope the fix narrowly

Fix only the identified root cause; do not bundle unrelated refactors or improvements into a bug-fix PR, per [Pull Request Process](../08-engineering/pull-request-process.md) scope discipline.

## 6. Check documentation accuracy

If the bug revealed that a PRD/domain doc/ADR was ambiguous or wrong (not just that code diverged from a correct spec), update the documentation in the same PR — see [Documentation Instructions](./documentation-instructions.md).

## 7. Validate and report

Run the full relevant test suite (not just the new regression test) to confirm no new regression was introduced. Report: the root cause, the fix, the regression test added, and whether the same bug class was checked for elsewhere.

## Security and data-integrity bugs are never "just a fix"

A bug involving tenant isolation, financial immutability, or audit completeness follows [Security Instructions](./security-instructions.md) in addition to this workflow — including confirming whether the bug was ever exploitable in a live environment, which may require escalation beyond a routine fix.

## Related documents

[Feature Development Workflow](./feature-development-workflow.md) · [Testing Instructions](./testing-instructions.md) · [Security Instructions](./security-instructions.md) · [Definition of Done](./definition-of-done.md)
