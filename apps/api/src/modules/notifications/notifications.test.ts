import { describe, expect, it } from 'vitest';
import { calculateReminderScheduledFor, reminderTypesForBooking } from './reminder-window.js';
import { isStartKeyword, isStopKeyword } from './opt-out.js';
import { buildNotificationContent } from '../receptionist/notification-content.js';

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

describe('buildNotificationContent', () => {
  it('scopes content to a single booking', () => {
    const body = buildNotificationContent({
      type: 'reminder_2h',
      businessName: 'Braids by Amara',
      styleName: 'Knotless braids',
      startTime: new Date('2026-07-20T14:00:00.000Z'),
      timeZone: 'Europe/London',
    });

    expect(body).toContain('Knotless braids');
    expect(body).toContain('Braids by Amara');
    expect(body).toContain('2 hours');
  });
});
