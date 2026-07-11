import type {
  CalendarConflict,
  CalendarConflictResolution,
  ResolveCalendarConflictRequest,
} from '@project-braids/shared-types/api';
import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';

function toCalendarConflict(row: {
  id: string;
  businessId: string;
  bookingId: string | null;
  externalEventId: string;
  detectedAt: Date;
  resolvedAt: Date | null;
  resolution: CalendarConflictResolution | null;
}): CalendarConflict {
  return {
    id: row.id,
    businessId: row.businessId,
    bookingId: row.bookingId,
    externalEventId: row.externalEventId,
    detectedAt: row.detectedAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    resolution: row.resolution,
  };
}

export class CalendarConflictService {
  /** Ch.7.6 — interface for Chapter 8 calendar reconciliation. */
  async flagExternalCalendarConflict(input: {
    businessId: string;
    externalEventId: string;
    conflictingBookingId?: string;
  }): Promise<CalendarConflict> {
    const created = await prisma.calendarConflict.create({
      data: {
        businessId: input.businessId,
        bookingId: input.conflictingBookingId ?? null,
        externalEventId: input.externalEventId,
      },
    });
    return toCalendarConflict(created);
  }

  async listUnresolved(businessId: string): Promise<CalendarConflict[]> {
    const rows = await prisma.calendarConflict.findMany({
      where: { businessId, resolvedAt: null },
      orderBy: { detectedAt: 'desc' },
    });
    return rows.map(toCalendarConflict);
  }

  async resolveConflict(
    businessId: string,
    conflictId: string,
    input: ResolveCalendarConflictRequest,
  ): Promise<CalendarConflict> {
    const existing = await prisma.calendarConflict.findFirst({
      where: { id: conflictId, businessId },
    });
    if (!existing) {
      throw ApiError.notFound('Calendar conflict not found');
    }
    if (existing.resolvedAt) {
      throw ApiError.validation('Conflict is already resolved');
    }

    const updated = await prisma.calendarConflict.update({
      where: { id: conflictId },
      data: {
        resolution: input.resolution,
        resolvedAt: new Date(),
      },
    });
    return toCalendarConflict(updated);
  }
}

export const calendarConflictService = new CalendarConflictService();
