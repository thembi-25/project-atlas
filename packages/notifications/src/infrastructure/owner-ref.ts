/**
 * A notification_preferences/notifications row's owner or recipient is
 * exactly one of a staff User or a Portal Contact — mirrors the table's
 * own `owner_type`/`recipient_type` discriminator (schema/notifications.ts).
 */
export type OwnerRef =
  | { ownerType: 'user'; ownerUserId: string }
  | { ownerType: 'contact'; ownerContactId: string };
