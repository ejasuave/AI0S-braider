import { describe, expect, it } from 'vitest';
import {
  TRANSACTIONAL_NOTIFICATION_TYPES,
  type NotificationType,
} from '@project-braids/shared-types/api';
import { calculateReminderScheduledFor, reminderTypesForBooking } from './reminder-window.js';
import { isStartKeyword, isStopKeyword } from './opt-out.js';
import { generateNotificationContent } from './content.js';
import {
  isReminderNotificationType,
  isTransactionalNotificationType,
  shouldCheckAppointmentRemindersPreference,
  shouldCheckMarketingPreference,
} from './preference-gating.js';

const baseContext = {
  businessName: 'Braids by Amara',
  styleName: 'Knotless braids',
  startTime: new Date('2026-07-20T14:00:00.000Z'),
  timeZone: 'Europe/London',
};

describe('calculateReminderScheduledFor', () => {
  const appointment = new Date('2026-07-20T14:00:00.000Z');

  it('schedules 48h reminder two days before', () => {
    const scheduled = calculateReminderScheduledFor(
      appointment,
      'reminder_48h',
      new Date('2026-07-10T00:00:00.000Z'),
    );
    expect(scheduled?.toISOString()).toBe('2026-07-18T14:00:00.000Z');
  });

  it('returns null when reminder window has already passed', () => {
    const scheduled = calculateReminderScheduledFor(
      appointment,
      'reminder_48h',
      new Date('2026-07-19T00:00:00.000Z'),
    );
    expect(scheduled).toBeNull();
  });

  it('includes only applicable reminder types', () => {
    const types = reminderTypesForBooking(appointment, new Date('2026-07-19T12:00:00.000Z'));
    expect(types).toEqual(['reminder_2h']);
  });

  it('skips both reminders when lead time is under 2 hours', () => {
    const types = reminderTypesForBooking(appointment, new Date('2026-07-20T13:30:00.000Z'));
    expect(types).toEqual([]);
  });
});

describe('STOP keyword handling', () => {
  it('detects STOP variants', () => {
    expect(isStopKeyword('STOP')).toBe(true);
    expect(isStopKeyword('  unsubscribe ')).toBe(true);
    expect(isStopKeyword('Can I book tomorrow?')).toBe(false);
  });

  it('detects START variants', () => {
    expect(isStartKeyword('START')).toBe(true);
    expect(isStartKeyword('unstop')).toBe(true);
  });
});

describe('generateNotificationContent', () => {
  const types = [
    'confirmation',
    'cancellation',
    'no_show_notice',
    'reminder_48h',
    'reminder_2h',
  ] as const;

  it.each(types)('produces non-empty client copy for %s', (type) => {
    const body = generateNotificationContent({
      ...baseContext,
      type,
      audience: 'client',
      depositDisposition: type === 'cancellation' ? 'full_refund' : undefined,
    });
    expect(body.length).toBeGreaterThan(20);
    expect(body).toContain('Knotless braids');
  });

  it('includes venue line on confirmation', () => {
    const body = generateNotificationContent({
      ...baseContext,
      type: 'confirmation',
      audience: 'client',
      venueLine: 'Location: 12 High Street.',
    });
    expect(body).toContain('Location: 12 High Street.');
  });

  it('includes client name for stylist confirmation', () => {
    const body = generateNotificationContent({
      ...baseContext,
      type: 'confirmation',
      audience: 'stylist',
      clientDisplayName: 'Amina',
      venueLine: 'Home visit at 1 Test Road.',
    });
    expect(body).toContain('Amina');
    expect(body).toContain('Home visit at 1 Test Road.');
  });

  it('includes refund language on cancellation', () => {
    const body = generateNotificationContent({
      ...baseContext,
      type: 'cancellation',
      audience: 'client',
      depositDisposition: 'full_refund',
    });
    expect(body).toContain('refunded');
  });

  it('includes forfeit language on cancellation', () => {
    const body = generateNotificationContent({
      ...baseContext,
      type: 'cancellation',
      audience: 'client',
      depositDisposition: 'forfeit_deposit',
    });
    expect(body).toContain('non-refundable');
  });

  it('includes deposit on stylist confirmation', () => {
    const body = generateNotificationContent({
      ...baseContext,
      type: 'confirmation',
      audience: 'stylist',
      depositAmount: 30,
      depositPaid: true,
    });
    expect(body).toContain('£30');
  });
});

describe('preference gating regression (Ch.12.3/12.4)', () => {
  it('only gates reminder types on appointment_reminders_enabled', () => {
    expect(shouldCheckAppointmentRemindersPreference('reminder_48h')).toBe(true);
    expect(shouldCheckAppointmentRemindersPreference('reminder_2h')).toBe(true);
    for (const type of TRANSACTIONAL_NOTIFICATION_TYPES) {
      expect(shouldCheckAppointmentRemindersPreference(type)).toBe(false);
    }
  });

  it('never gates any type on marketing_messages_enabled', () => {
    const allTypes: NotificationType[] = [
      ...TRANSACTIONAL_NOTIFICATION_TYPES,
      'reminder_48h',
      'reminder_2h',
    ];
    for (const type of allTypes) {
      expect(shouldCheckMarketingPreference(type)).toBe(false);
    }
  });

  it('classifies transactional types correctly', () => {
    expect(isTransactionalNotificationType('confirmation')).toBe(true);
    expect(isReminderNotificationType('reminder_2h')).toBe(true);
    expect(isTransactionalNotificationType('reminder_2h')).toBe(false);
  });
});
