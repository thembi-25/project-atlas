# Infrastructure

Project Atlas deliberately does not use a general-purpose infrastructure-as-code
tool (Terraform, Pulumi, CloudFormation) — see
[`docs/02-architecture/architecture-principles.md`](../docs/02-architecture/architecture-principles.md)
and [`docs/11-adr/ADR-026-deployment-strategy.md`](../docs/11-adr/ADR-026-deployment-strategy.md).
The platform (Vercel, Supabase) is configured through:

- Vercel project settings + the Vercel CLI (environment variables, domains, deployment
  protection) — see [`docs/10-devops/deployment.md`](../docs/10-devops/deployment.md).
- The Supabase CLI + dashboard (project provisioning, Auth/Storage configuration,
  database branching for Preview environments) — see
  [`docs/10-devops/environment-management.md`](../docs/10-devops/environment-management.md).
- GitHub Actions workflow files in [`.github/workflows/`](../.github/workflows/) for
  CI/CD — see [`docs/10-devops/ci-cd.md`](../docs/10-devops/ci-cd.md).

This directory exists as the place such configuration would live if and when it
becomes code (e.g., a `supabase/config.toml` for local Supabase CLI configuration,
added when local Supabase is actually provisioned in this environment — see
[`docs/13-roadmap/SPRINT-0-COMPLETION-REPORT.md`](../docs/13-roadmap/SPRINT-0-COMPLETION-REPORT.md),
"Known Issues"). It is intentionally empty of generated/placeholder config as of
Sprint 0 — nothing here should be invented ahead of an actual infrastructure need.
