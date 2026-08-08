# Identity — PRD

## 1. Purpose

Identity governs how a person authenticates to Atlas and gains access to one or more Organizations. It is the foundation every other module's Permission checks depend on.

## 2. Business problem

Field-service businesses today share logins, use generic "admin" accounts, or have no way to limit what a new hire can see/do on day one — leading to accidental data exposure and no accountability trail when something goes wrong (e.g., a discounted invoice with no record of who approved it).

## 3. Goals

- Every person acting in Atlas has their own attributable identity.
- Access within an Organization is governed by Role, assignable and revocable in seconds.
- A person who works with multiple Organizations (e.g., a bookkeeper) needs only one login.

## 4. Non-goals

- Single sign-on (SSO)/SAML for enterprise identity providers — not needed for the target segment (see [Target Customers](../00-overview/target-customers.md)).
- Custom, per-Organization Role definitions — see [Roles](../03-domain/roles.md), Future Extensions.

## 5. Personas

[Maria (Owner)](../00-overview/user-personas.md), [Denise (Dispatcher)](../00-overview/user-personas.md) as an invited Admin, every persona as an invitee.

## 6. User stories

- As an Owner, I want to invite a new hire by email and assign their Role, so they can start working without me sharing my own login.
- As an Owner, I want to immediately revoke a former employee's access, so a departure doesn't leave a security gap.
- As a User who works with two Organizations, I want to switch between them without logging out.

## 7. Functional requirements

- Invite a person by email with a selected Role; invitee completes account setup (or links an existing Atlas identity) via a secure, expiring invitation link.
- Suspend/reinstate/remove a Membership.
- Enforce MFA (TOTP) for Owner/Admin Roles.
- Support switching active Organization context for multi-Organization Users.

## 8. Business rules

See [Users](../03-domain/users.md) and [Roles](../03-domain/roles.md) Business Rules in full — notably: an Organization always has ≥1 active Owner Membership; email is unique platform-wide; Role changes take effect on the next request, never delayed by cached tokens.

## 9. State machines

Membership status state machine — see [Users](../03-domain/users.md#state-machine-membership-status).

## 10. Data requirements

`users`, `organization_memberships`, `membership_roles`, `roles`, `permissions`, `role_permissions` — see [Schema Overview](../04-database/schema-overview.md).

## 11. API requirements

`POST /api/v1/organizations/{id}/invitations`, `POST /api/v1/invitations/{token}/accept`, `PATCH /api/v1/memberships/{id}` (status/Role changes), `GET /api/v1/memberships`. All Membership-mutating endpoints restricted to Owner/Admin.

## 12. Permission requirements

Only Owner/Admin can invite, change Roles, suspend, or remove Memberships. A User can always read and update their own profile fields (name, phone, notification preferences).

## 13. UI requirements

Organization Settings → Team page: list of Memberships with Role, status, last active; invite flow; MFA setup prompt for Owner/Admin on first login.

## 14. Notifications

Invitation email (with secure link), Role-change notification to the affected User, suspicious-login alert (new device/location) to the affected User.

## 15. Audit requirements

Every invitation, Role change, suspension, removal, and MFA enrollment/disable produces an [Audit Event](../03-domain/audit-events.md) — these are among the highest-sensitivity Audit Events in the system and are never suppressible.

## 16. Error cases

Duplicate invitation to an already-active Membership (`409`); attempt to remove the last Owner Membership (`409`, blocked per Business Rules); expired/already-used invitation token (`422`).

## 17. Edge cases

A User invited to an Organization while already having a pending invitation to a *different* Organization — both proceed independently. A User's email changes at the identity-provider level — Membership references the stable `user_id`, unaffected. An Owner attempts to demote themselves to Technician while being the sole Owner — blocked.

## 18. Acceptance criteria

**Given** an Organization with exactly one Owner, **when** an Admin attempts to remove that Owner's Membership, **then** the request is rejected with `409` and a clear message. **Given** a suspended Membership, **when** that User attempts any `/api/v1/` request under that Organization, **then** every request returns `403` regardless of previously cached client-side state.

## 19. Testing requirements

Integration tests for the full invite → accept → active lifecycle; RLS tests confirming a suspended/removed Membership loses access immediately (no token-refresh dependency); unit tests for the last-Owner-protection rule.

## 20. Future extensions

SSO/SAML for larger future customers; custom per-Organization Roles; delegated/temporary access grants (e.g., a contractor given time-boxed access).
