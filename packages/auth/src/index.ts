/**
 * Authentication foundation — Supabase Auth client wiring only.
 *
 * Role/Permission/Membership resolution (RBAC — see docs/03-domain/roles.md,
 * docs/03-domain/permissions.md) is Identity domain scope and is NOT part
 * of this package. It begins in Sprint 1 — see
 * docs/13-roadmap/sprint-1.md and docs/11-adr/ADR-008-rbac.md.
 */
export { createSupabaseServerClient } from './server-client';
export { createSupabaseBrowserClient } from './browser-client';
export type { CookieAdapter, SupabaseConnectionConfig } from './types';
