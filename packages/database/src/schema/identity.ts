import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from './org';

/**
 * Identity domain: platform-wide Users, Organization Memberships, and the
 * platform-fixed Role/Permission catalog. See docs/03-domain/users.md,
 * docs/03-domain/roles.md, docs/03-domain/permissions.md,
 * docs/13-roadmap/sprint-1.md.
 *
 * `organizations` is imported from ./org for the `organization_memberships`
 * foreign key. `org.ts` imports `users` back from here for `team_members` —
 * this is a deliberate, Drizzle-supported circular reference between the two
 * Postgres schemas (mirrors the real domain relationship); see
 * docs/04-database/foreign-keys.md.
 */
export const identitySchema = pgSchema('identity');

export const membershipStatusEnum = identitySchema.enum('membership_status', [
  'invited',
  'active',
  'suspended',
  'removed',
]);

/**
 * Platform-wide User identity. Mirrors/extends `auth.users` from Supabase
 * Auth — Atlas stores no password hashes here (see ADR-006). `id` is NOT
 * self-generated; it is always set to the corresponding `auth.users.id`
 * at first sign-in, keeping the two tables' primary keys identical.
 */
export const users = identitySchema.table(
  'users',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    avatarUrl: text('avatar_url'),
    defaultLocale: text('default_locale').notNull().default('en-US'),
    notificationChannelPreference: text('notification_channel_preference')
      .notNull()
      .default('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('uq_users_email').on(table.email)],
);

/**
 * A User's Membership in an Organization. An invited person may not yet
 * have a `users` row — see docs/03-domain/users.md's Membership state
 * machine (`invited -> active -> suspended/removed`) and Identity PRD §11
 * (invitation endpoints). Neither a dedicated invitations table nor an
 * invitation-token mechanism is specified in the docs (documented gap —
 * see SPRINT-1-COMPLETION-REPORT.md); the token/expiry fields below are
 * this sprint's resolution, stored directly on the Membership row while
 * `status = 'invited'`.
 */
export const organizationMemberships = identitySchema.table(
  'organization_memberships',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`public.uuid_generate_v7()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id').references(() => users.id),
    status: membershipStatusEnum('status').notNull().default('invited'),
    jobTitle: text('job_title'),
    invitedEmail: text('invited_email'),
    invitedByUserId: uuid('invited_by_user_id').references(() => users.id),
    invitedAt: timestamp('invited_at', { withTimezone: true }),
    invitationTokenHash: text('invitation_token_hash'),
    invitationExpiresAt: timestamp('invitation_expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_organization_memberships_user_org').on(table.userId, table.organizationId),
    uniqueIndex('uq_org_memberships_org_invited_email')
      .on(table.organizationId, table.invitedEmail)
      .where(sql`${table.status} = 'invited'`),
    index('idx_organization_memberships_organization_id_status').on(
      table.organizationId,
      table.status,
    ),
    index('idx_organization_memberships_invitation_token_hash').on(table.invitationTokenHash),
    check(
      'chk_organization_memberships_user_or_email',
      sql`${table.userId} is not null or ${table.invitedEmail} is not null`,
    ),
  ],
);

/** Platform-fixed Roles — see docs/03-domain/roles.md. Not tenant-scoped. */
export const roles = identitySchema.table(
  'roles',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`public.uuid_generate_v7()`),
    name: text('name').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('uq_roles_name').on(table.name)],
);

/** Join of Membership <-> Role (many-to-many) — a Membership can hold more than one Role. */
export const membershipRoles = identitySchema.table(
  'membership_roles',
  {
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => organizationMemberships.id),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.membershipId, table.roleId] })],
);

/** Platform-fixed Permission catalog (`resource:action`) — see docs/03-domain/permissions.md. */
export const permissions = identitySchema.table(
  'permissions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`public.uuid_generate_v7()`),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
  },
  (table) => [uniqueIndex('uq_permissions_resource_action').on(table.resource, table.action)],
);

/**
 * Role <-> Permission mapping (seed data, platform-fixed at launch — ADR-008).
 * Composite primary key per docs/04-database/primary-keys.md's join-table exception.
 */
export const rolePermissions = identitySchema.table(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);
