# Claude Code Guide

## Start here

This is the entry point for Claude Code (or any engineer) working on Project Atlas implementation. Read this first, then follow the links relevant to your specific task.

## What this documentation set is

The complete product, architecture, domain, database, API, security, engineering, and roadmap specification for Project Atlas, authored before any production implementation exists. It is the **authoritative source of truth** — see [`docs/README.md`](../README.md) for the full map.

## Before touching any code

1. Confirm the task is in scope for the current Technical Implementation Phase — see [ROADMAP-DECISION.md](../13-roadmap/ROADMAP-DECISION.md) for the authoritative Strategic Product Phase / Technical Implementation Phase / Sprint distinction, and [Implementation Roadmap](../13-roadmap/implementation-roadmap.md) for the build plan. Do not implement any Strategic Phase 2+ (Property Intelligence, Marketplace, Manufacturers, Financial Services, Industry Data Network) capability while Technical Implementation Phases 1–2 (Engineering Foundation, Core Operations Build — the MVP) are incomplete.
2. Read the relevant module PRD in [`06-modules/`](../06-modules/).
3. Read the relevant domain model document(s) in [`03-domain/`](../03-domain/).
4. Read any ADRs in [`11-adr/`](../11-adr/) that govern the area — check [Related Decisions](../11-adr/) links from the domain/PRD docs you just read.
5. Inspect the existing implementation (if any) for the module — don't assume a fresh start once code exists.

## The rules that are never overridden by convenience

See [Implementation Rules](./implementation-rules.md) for the full list; the highest-stakes ones:
- Never invent a database table/column not documented in [`03-domain/`](../03-domain/) or [`04-database/`](../04-database/) — propose a documentation update first if one is genuinely needed.
- Never bypass Row Level Security — see [Tenant Isolation](../07-security/tenant-isolation.md).
- Never put business logic in a React/UI component — see [Architecture Principles](../02-architecture/architecture-principles.md).
- Never modify a module unrelated to the current task's stated scope.
- Never introduce a dependency not justified against [Technology Stack](../02-architecture/technology-stack.md).

## The workflow for every implementation task

See [Feature Development Workflow](./feature-development-workflow.md) and [Bug Fixing Workflow](./bug-fixing-workflow.md) for the full step-by-step process (read → plan → implement incrementally → test → validate → report).

## Task-specific instruction documents

| Concern | Document |
|---|---|
| General coding | [Coding Instructions](./coding-instructions.md) |
| Database/schema work | [Database Instructions](./database-instructions.md) |
| API endpoints | [API Instructions](./api-instructions.md) |
| Tests | [Testing Instructions](./testing-instructions.md) |
| Security-sensitive changes | [Security Instructions](./security-instructions.md) |
| Documentation updates | [Documentation Instructions](./documentation-instructions.md) |

## Definition of Done

No task is complete until it satisfies [Definition of Done](./definition-of-done.md) — this is the actual completion bar, not "the code compiles."

## When documentation and a request conflict

If a user request conflicts with this documentation (e.g., asks for a shortcut around RLS, or a table not in the domain model), say so explicitly and propose the documented-compliant approach, or propose the specific documentation change needed first — never silently implement a conflicting shortcut. See [Implementation Rules](./implementation-rules.md).
