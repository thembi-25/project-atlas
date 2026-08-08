# Pull Request Process

## PR requirements before requesting review

1. CI passes: lint, type-check, unit/integration tests, migration safety check (see [CI/CD](../10-devops/ci-cd.md)).
2. The PR description states: what changed, why, and which [PRD](../06-modules/)/[ADR](../11-adr/)/[domain doc](../03-domain/) it implements or is consistent with.
3. Tests are added/updated for the change — a PR changing behavior without a corresponding test change is a red flag for reviewers, per [Testing Strategy](../09-testing/testing-strategy.md).
4. Any schema migration includes the checklist items from [Migrations](../04-database/migrations.md).

## Review requirement

At least one approving review before merge; PRs touching authentication, authorization, RLS policies, or payment code require review from someone familiar with [Security Architecture](../07-security/security-architecture.md), and pass the [Security Testing](../09-testing/security-testing.md) checklist.

## Scope discipline

A PR modifies only the module(s) its description says it modifies — an incidental "while I was in there" change to an unrelated module is split into its own PR, consistent with the project-wide instruction that Claude/engineers must never modify unrelated modules without explicit scope.

## PR size

Reviewable in one sitting is the target — large PRs are split along the module/layer seams described in [Project Structure](./project-structure.md) wherever possible. An unavoidably large PR (e.g., an initial module scaffold) is flagged as such in its description with a suggested review order.

## Preview environment verification

Every PR gets an automatic Vercel Preview Deployment against an ephemeral database (see [Deployment Architecture](../02-architecture/deployment-architecture.md)) — reviewers verify UI-affecting changes there, not just by reading the diff, per the general engineering instruction to test the golden path in a browser for frontend changes.

## Merge criteria

- CI green.
- Approving review obtained.
- No unresolved review comments.
- Branch is up to date with `main` (or CI has re-run post-rebase) to avoid a stale-branch merge masking a conflict with recently merged work.

## Related documents

[Git Workflow](./git-workflow.md) · [Code Review](./code-review.md) · [CI/CD](../10-devops/ci-cd.md) · [Definition of Done](../12-claude/definition-of-done.md)
