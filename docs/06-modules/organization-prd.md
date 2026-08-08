# Organization — PRD

## 1. Purpose

Manage the Organization entity itself: its profile, trade configuration, Teams, and Organization-level settings that govern how every other module behaves for that tenant.

## 2. Business problem

A field-service business needs one place to configure how Atlas reflects their actual operation (which trades they offer, how their Technicians are grouped, their branding on customer documents) without engineering involvement.

## 3. Goals

- Self-service setup and ongoing configuration of Organization profile and trade types.
- Team management for scheduling/reporting grouping.
- A single, trustworthy place to see Organization-wide settings.

## 4. Non-goals

- Multi-branch/multi-entity billing structures within one Organization — see [Product Scope](../01-product/product-scope.md), out of scope for launch.
- Billing/subscription management UI itself may be a thin wrapper around the billing provider's hosted portal rather than a fully custom-built flow — implementation detail, not a PRD requirement here.

## 5. Personas

[Maria (Owner)](../00-overview/user-personas.md) primarily; [Denise (Dispatcher)](../00-overview/user-personas.md) for Team management if delegated Admin access.

## 6. User stories

- As an Owner, I want to set up my Organization's name, address, and the trades we offer, so the rest of the app reflects my business accurately.
- As an Owner, I want to create Teams (e.g., "HVAC Crew A") so Denise can filter the schedule board by crew.
- As an Owner, I want to upload our logo so it appears on Estimates and Invoices.

## 7. Functional requirements

- CRUD for Organization profile fields, trade type selection, branding assets.
- CRUD for Teams and Team membership.
- View/manage subscription tier (see [Pricing Strategy](../01-product/pricing-strategy.md)).

## 8. Business rules

See [Organization](../03-domain/organization.md) Business Rules — every tenant-owned record traces to exactly one Organization; only Owner/Admin can modify Organization-level settings; Organization deactivation is soft and reversible within a retention window.

## 9. State machines

Organization subscription status (`trialing`, `active`, `past_due`, `cancelled`) — managed primarily by the billing provider's webhook state, mirrored read-only into Atlas.

## 10. Data requirements

`organizations`, `teams`, `team_members` — see [Schema Overview](../04-database/schema-overview.md).

## 11. API requirements

`GET/PATCH /api/v1/organizations/{id}`, `GET/POST/PATCH/DELETE /api/v1/teams`, `POST /api/v1/teams/{id}/members`.

## 12. Permission requirements

Owner/Admin: full read/write on Organization settings and Teams. All other Roles: read-only on Organization profile (needed for e.g. displaying branding), no access to billing.

## 13. UI requirements

Settings → Organization Profile, Settings → Teams, Settings → Billing (links to billing provider portal for plan changes).

## 14. Notifications

Billing status change (past due, cancelled) notifies Owner via email; Team membership change notifies affected User.

## 15. Audit requirements

All Organization profile/settings changes and Team membership changes produce [Audit Events](../03-domain/audit-events.md).

## 16. Error cases

Attempting to remove a trade type still referenced by active `job_types`/`asset_types` (`409`, must reassign/retire the dependent configuration first).

## 17. Edge cases

An Organization operating in a single trade adds a second trade mid-lifecycle — existing Jobs/Assets are unaffected; new trade's default `job_types`/`asset_types` become available going forward.

## 18. Acceptance criteria

**Given** an Organization with active Jobs, **when** an Owner attempts to deactivate the Organization, **then** the system requires explicit confirmation and performs a soft deactivation, never an immediate hard delete of any data.

## 19. Testing requirements

Integration tests for Team CRUD and membership, permission tests confirming only Owner/Admin can modify settings, RLS tests for Organization-scoped Team visibility.

## 20. Future extensions

Multi-branch/location support under one Organization; configurable per-Organization Roles (ties to [Roles](../03-domain/roles.md) Future Extensions); org-level custom fields.
