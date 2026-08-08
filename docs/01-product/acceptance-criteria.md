# Acceptance Criteria

This document defines the cross-cutting acceptance criteria format and the launch-critical criteria at a system level. Module-specific acceptance criteria (the required PRD section 18) live in each file under [`06-modules/`](../06-modules/).

## Format

Acceptance criteria are written Given/When/Then and must be automatable as either an [integration test](../09-testing/integration-testing.md) or an [end-to-end test](../09-testing/end-to-end-testing.md).

## System-level acceptance criteria (must hold across every module)

### Tenant isolation
- **Given** a User authenticated into Organization A, **when** they request a resource belonging to Organization B by ID, **then** the API returns 404 (not 403, to avoid confirming the resource's existence) and no data from Organization B is returned. See [Tenant Isolation](../07-security/tenant-isolation.md).

### Permission enforcement
- **Given** a User with the Technician Role, **when** they request an endpoint restricted to Accountant/Owner (e.g., organization-wide revenue report), **then** the API returns 403 and the UI does not render the restricted action. See [Authorization](../05-api/authorization.md).

### Audit trail completeness
- **Given** any create/update/delete of a tenant-owned record, **when** the operation succeeds, **then** exactly one corresponding Audit Event is persisted with actor, timestamp, entity type/ID, and a diff of changed fields. See [Audit Events](../03-domain/audit-events.md).

### Financial immutability
- **Given** a finalized Invoice, **when** any user attempts to directly edit its line items or total, **then** the system rejects the edit and requires a documented adjustment/credit flow instead. See [Invoices](../03-domain/invoices.md).

### Job state machine integrity
- **Given** a Job in a terminal state (Completed, Cancelled), **when** an invalid transition is attempted (e.g., Completed → Scheduled), **then** the system rejects the transition with a descriptive error. See [Jobs](../03-domain/jobs.md), State Machine.

### Idempotent payment capture
- **Given** a payment capture request submitted twice with the same idempotency key (e.g., due to a mobile network retry), **when** both requests are processed, **then** only one Payment record and one charge are created. See [ADR-018](../11-adr/ADR-018-payments.md).

## Launch (Phase 1–2) release acceptance gate

The launch release is not acceptance-tested feature-by-feature alone; it must also pass:
1. All system-level acceptance criteria above, verified in CI. See [Testing Strategy](../09-testing/testing-strategy.md).
2. Every Functional Requirement in [Functional Requirements](./functional-requirements.md) has at least one passing automated test.
3. The security review checklist in [Security Testing](../09-testing/security-testing.md) passes with no unresolved high-severity findings.
4. The [Definition of Done](../12-claude/definition-of-done.md) is satisfied for every module in scope.

## Non-negotiable failure conditions

A release is blocked, regardless of feature completeness, if:
- Any tenant-isolation acceptance criterion fails.
- Any financial-immutability acceptance criterion fails.
- Any Audit Event is found to be missing for a tested state-changing operation.
