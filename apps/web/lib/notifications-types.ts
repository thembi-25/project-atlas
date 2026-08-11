/** Client-side mirror of apps/web/lib/notifications-serializers.ts's JSON shape. */
export interface NotificationPreferenceDto {
  id: string;
  organization_id: string;
  owner_type: 'user' | 'contact';
  owner_user_id: string | null;
  owner_contact_id: string | null;
  event_type: string;
  channel: 'email' | 'sms';
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationDto {
  id: string;
  organization_id: string;
  recipient_type: 'user' | 'contact';
  recipient_user_id: string | null;
  recipient_contact_id: string | null;
  event_type: string;
  channel: 'email' | 'sms';
  status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';
  subject: string | null;
  body: string;
  provider_message_id: string | null;
  error_detail: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export const NOTIFICATION_EVENT_TYPES = [
  'job.dispatched',
  'job.completed',
  'estimate.approved',
  'invoice.finalized',
  'payment.received',
] as const;

export const NOTIFICATION_CHANNELS = ['email', 'sms'] as const;
