# Git Workflow

## Branching model

Trunk-based development: `main` is always deployable (to Staging automatically — see [Deployment Architecture](../02-architecture/deployment-architecture.md)). All work happens on short-lived feature branches off `main`, named `<type>/<short-description>` (e.g., `feat/job-checklist-override`, `fix/invoice-balance-rounding`, `docs/warranty-prd`).

## Commit messages

Conventional-commit-style prefixes (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`) describing *why*, not just *what* — a commit message should make sense to someone with no other context reading it in `git log` a year later.

## No direct pushes to `main`

All changes land via pull request (see [Pull Request Process](./pull-request-process.md)); `main` is branch-protected requiring passing CI and at least one approving review.

## Merge strategy

Squash-merge to `main` — each PR becomes one commit in `main`'s history, keeping the trunk history readable, while the feature branch's exploratory commit history is preserved on the (eventually deleted) branch/PR itself for reference during review.

## Migrations and feature branches

A migration merged to `main` runs against Staging automatically (see [Migrations](../04-database/migrations.md), [Database Deployment](../10-devops/database-deployment.md)) — a feature branch with a migration is tested against its own ephemeral Preview database branch first, never applied speculatively against shared Staging before merge.

## Handling long-running feature work

Large features are broken into a sequence of smaller, independently-mergeable PRs behind a structural seam (e.g., ship a new module's data layer before its UI) rather than one long-lived branch accumulating drift from `main` — consistent with [Coding Standards](./coding-standards.md)'s "no half-finished implementations" principle applying at the PR level: each merged PR is itself complete and correct, even if the overall feature isn't done yet.

## Related documents

[Pull Request Process](./pull-request-process.md) · [CI/CD](../10-devops/ci-cd.md) · [Code Review](./code-review.md)
