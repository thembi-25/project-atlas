# Dependency Management

## Principle: every dependency is a deliberate decision

A new runtime dependency is added only when it solves a problem the [Technology Stack](../02-architecture/technology-stack.md) doesn't already cover, and is justified in the PR description — consistent with [Product Principles](../00-overview/product-principles.md) and the instruction that Claude/engineers must never introduce dependencies without justification. A new dependency that duplicates something already in the stack (a second date library, a second HTTP client) is rejected in review.

## Adding a dependency: checklist

1. Does an existing dependency in [Technology Stack](../02-architecture/technology-stack.md) already solve this?
2. Is it actively maintained (recent commits, responsive to security issues)?
3. What's its bundle-size/cold-start impact, given the app runs on Vercel serverless functions?
4. Does it have a compatible license (permissive — MIT/Apache/BSD; no copyleft licenses that would affect Atlas's proprietary codebase)?
5. Is it added to the correct workspace package (not hoisted to the root unless genuinely shared across all packages)?

## Version management

- Exact versions (no `^`/`~` ranges) for dependencies in `packages/db` and anything touching data integrity (Drizzle, Zod) to avoid an unreviewed transitive upgrade silently changing schema-generation or validation behavior.
- Standard caret ranges elsewhere, with `pnpm`'s lockfile as the actual source of truth for what's installed.
- Dependabot (or equivalent) opens automated PRs for updates; patch/minor updates to low-risk dependencies can be merged after CI passes; major version bumps and any update to a security-sensitive dependency (auth, crypto, payment SDKs) get explicit review.

## Security scanning

Automated vulnerability scanning (e.g., `pnpm audit` / GitHub Dependabot alerts) runs in CI on every PR and on a daily schedule against `main` — see [API Security](../07-security/api-security.md). A high/critical vulnerability blocks merge unless explicitly, temporarily accepted with a documented reason and a tracked follow-up.

## Removing dependencies

An unused dependency (detected via periodic audit, e.g., `depcheck`) is removed promptly — an unused dependency is still a security surface and a maintenance cost even if nothing currently imports it.

## Related documents

[Technology Stack](../02-architecture/technology-stack.md) · [API Security](../07-security/api-security.md) · [CI/CD](../10-devops/ci-cd.md)
