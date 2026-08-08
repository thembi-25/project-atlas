# Authentication Security

## Password policy

Delegated to Supabase Auth's configuration: minimum 12 characters, checked against a known-breached-password list at signup/change, no forced periodic rotation (rotation-on-schedule is a discredited practice that encourages weak, predictable password patterns — Atlas instead relies on strength + breach checking + MFA). See [Authentication](../05-api/authentication.md), [ADR-006](../11-adr/ADR-006-authentication.md).

## MFA

TOTP-based MFA is **required** for Owner and Admin Roles (the Roles with the broadest blast radius — billing, user management, full financial access) and optional but encouraged for all other Roles. Enforcement: a Membership with an Owner/Admin Role that hasn't completed MFA enrollment is blocked from any write action after a short grace period, with persistent in-app prompting during the grace period.

## Session security

- Sessions are `httpOnly`, `Secure`, `SameSite=Lax` cookies — never `localStorage` — eliminating a large class of XSS-driven token theft. See [Authentication](../05-api/authentication.md).
- Access tokens are short-lived (Supabase default ~1 hour); refresh tokens are rotated on use.
- A User can view and revoke active sessions/devices from their account settings (Admin/Owner additionally see this for their own account only, not other Users', for privacy — session revocation for other Users happens via Membership suspension, not session enumeration).

## Brute-force and credential-stuffing protection

- Per-IP rate limiting on login/password-reset/MFA-verification endpoints — see [Rate Limiting](../05-api/rate-limiting.md).
- Account lockout after repeated failed attempts is time-boxed (not permanent) and always paired with an alert email to the account owner, so a legitimate user isn't permanently locked out by an attacker's attempts, while the attacker is still slowed.
- Supabase Auth's built-in breached-credential and anomaly detection (where available) is enabled.

## Account takeover response

- New-device/new-location login triggers an email alert to the User (informational, not blocking, to avoid excessive friction for legitimate travel/new-device use).
- Owner/Admin can force-suspend a Membership immediately (see [Users](../03-domain/users.md), Membership state machine) if an account is believed compromised — this takes effect on the very next request, per the live-Membership-state enforcement in [Multi-Tenancy](../04-database/multi-tenancy.md).

## Customer Portal authentication distinction

Portal Contacts authenticate via magic link (no password to compromise via credential stuffing), consistent with their lighter-weight access needs — see [Customer Portal PRD](../06-modules/customer-portal-prd.md). Magic links are single-use, short-expiry, and delivered only to the verified email on file for that Contact.

## Related documents

[Authentication](../05-api/authentication.md) · [Tenant Isolation](./tenant-isolation.md) · [ADR-006: Authentication](../11-adr/ADR-006-authentication.md) · [Rate Limiting](../05-api/rate-limiting.md)
