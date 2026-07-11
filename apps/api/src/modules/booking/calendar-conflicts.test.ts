import { describe, expect, it } from 'vitest';
import { calendarConflictService } from './calendar-conflicts.js';

describe('calendarConflictService', () => {
  it('exports flag and resolve functions', () => {
    expect(typeof calendarConflictService.flagExternalCalendarConflict).toBe('function');
    expect(typeof calendarConflictService.listUnresolved).toBe('function');
    expect(typeof calendarConflictService.resolveConflict).toBe('function');
  });
});
