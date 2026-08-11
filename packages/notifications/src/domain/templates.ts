import type { NotificationChannel } from './event-catalog';

/**
 * Pure, business-logic-free rendering of the launch-scope event catalog
 * into recipient-facing content — notifications-prd.md §7. Kept as plain
 * template functions (no template-engine dependency) since every event's
 * content is a short, fixed shape; SMS bodies stay under ~160 chars where
 * practical (carrier segmenting, not enforced here), email bodies are a
 * short HTML fragment. Which event/audience combination triggers a send,
 * and gathering the data below, is the Worker handler's job (see
 * apps/worker/src/handlers/*) — this module only renders.
 */
export type NotificationEvent =
  | { type: 'job.dispatched'; jobNumber: string; technicianName: string; scheduledStart: Date }
  | { type: 'job.completed'; jobNumber: string }
  | { type: 'estimate.approved'; estimateNumber: string; jobNumber: string }
  | { type: 'invoice.finalized'; invoiceNumber: string; total: string; dueDate: Date | null }
  | { type: 'payment.received'; amount: string; invoiceNumber: string };

export interface RenderedNotification {
  subject?: string;
  body: string;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function renderNotificationContent(
  event: NotificationEvent,
  channel: NotificationChannel,
): RenderedNotification {
  switch (event.type) {
    case 'job.dispatched': {
      const when = formatDate(event.scheduledStart);
      if (channel === 'sms') {
        return { body: `Job #${event.jobNumber}: ${event.technicianName} is dispatched, arriving around ${when}.` };
      }
      return {
        subject: `Job #${event.jobNumber} — Technician dispatched`,
        body: `<p>${event.technicianName} has been dispatched to Job #${event.jobNumber}, arriving around ${when}.</p>`,
      };
    }
    case 'job.completed': {
      if (channel === 'sms') {
        return { body: `Job #${event.jobNumber} is complete. Thank you for your business.` };
      }
      return {
        subject: `Job #${event.jobNumber} completed`,
        body: `<p>Job #${event.jobNumber} has been marked complete. Thank you for your business.</p>`,
      };
    }
    case 'estimate.approved': {
      if (channel === 'sms') {
        return { body: `Estimate #${event.estimateNumber} was approved. Job #${event.jobNumber} is ready to proceed.` };
      }
      return {
        subject: `Estimate #${event.estimateNumber} approved`,
        body: `<p>Estimate #${event.estimateNumber} was approved. Job #${event.jobNumber} is ready to proceed.</p>`,
      };
    }
    case 'invoice.finalized': {
      const due = event.dueDate ? ` Due ${formatDate(event.dueDate)}.` : '';
      if (channel === 'sms') {
        return { body: `Invoice #${event.invoiceNumber} for ${event.total} is ready.${due}` };
      }
      return {
        subject: `Invoice #${event.invoiceNumber} — ${event.total}`,
        body: `<p>Invoice #${event.invoiceNumber} for ${event.total} is ready.${due}</p>`,
      };
    }
    case 'payment.received': {
      if (channel === 'sms') {
        return { body: `Payment of ${event.amount} received for Invoice #${event.invoiceNumber}. Thank you.` };
      }
      return {
        subject: `Payment received — Invoice #${event.invoiceNumber}`,
        body: `<p>We received your payment of ${event.amount} for Invoice #${event.invoiceNumber}. Thank you.</p>`,
      };
    }
  }
}
