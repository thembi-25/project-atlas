import { describe, expect, it } from 'vitest';
import { renderNotificationContent, type NotificationEvent } from './templates';

describe('renderNotificationContent', () => {
  it('renders a short, subject-less body for SMS', () => {
    const event: NotificationEvent = {
      type: 'job.dispatched',
      jobNumber: 'J-1001',
      technicianName: 'Alex Rivera',
      scheduledStart: new Date('2026-08-11T14:00:00Z'),
    };
    const result = renderNotificationContent(event, 'sms');
    expect(result.subject).toBeUndefined();
    expect(result.body).toContain('J-1001');
    expect(result.body).toContain('Alex Rivera');
  });

  it('renders a subject and HTML body for email', () => {
    const event: NotificationEvent = { type: 'job.completed', jobNumber: 'J-1001' };
    const result = renderNotificationContent(event, 'email');
    expect(result.subject).toContain('J-1001');
    expect(result.body).toContain('<p>');
  });

  it('includes the due date only when present (invoice.finalized)', () => {
    const withDue = renderNotificationContent(
      { type: 'invoice.finalized', invoiceNumber: 'INV-1', total: '$100.00', dueDate: new Date('2026-09-01') },
      'sms',
    );
    expect(withDue.body).toContain('Due');

    const withoutDue = renderNotificationContent(
      { type: 'invoice.finalized', invoiceNumber: 'INV-1', total: '$100.00', dueDate: null },
      'sms',
    );
    expect(withoutDue.body).not.toContain('Due');
  });

  it('renders payment.received content for both channels', () => {
    const event: NotificationEvent = { type: 'payment.received', amount: '$50.00', invoiceNumber: 'INV-2' };
    expect(renderNotificationContent(event, 'sms').body).toContain('$50.00');
    expect(renderNotificationContent(event, 'email').subject).toContain('INV-2');
  });

  it('renders estimate.approved content', () => {
    const event: NotificationEvent = { type: 'estimate.approved', estimateNumber: 'EST-1', jobNumber: 'J-5' };
    const result = renderNotificationContent(event, 'email');
    expect(result.body).toContain('EST-1');
    expect(result.body).toContain('J-5');
  });
});
