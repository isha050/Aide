import { ToolDecorator as Tool, ExecutionContext, z } from '@nitrostack/core';
import { findMeetingSlot, bookMeeting } from '../../scheduling.js';

/**
 * MCP tool wrappers for the scheduling functions.
 *
 * Each tool's `inputSchema` matches the contract exactly:
 * - find_meeting_slot: { attendees, durationMinutes, urgency }
 * - book_meeting:      { slot, attendees }
 */
export class SchedulingTools {
  @Tool({
    name: 'find_meeting_slot',
    description:
      'Find available meeting slots across multiple attendees\' calendars. ' +
      'Returns up to 3 conflict-free proposed time slots, any scheduling ' +
      'conflicts encountered, and reasoning about the search.',
    inputSchema: z.object({
      attendees: z
        .array(z.string())
        .describe('List of attendee names to check availability for'),
      durationMinutes: z
        .number()
        .positive()
        .describe('Required meeting duration in minutes'),
      urgency: z
        .enum(['low', 'medium', 'high'])
        .describe(
          'Search urgency — high: 1-day window, medium: 3-day, low: 7-day'
        ),
    }),
    examples: {
      request: {
        attendees: ['alice', 'bob', 'charlie'],
        durationMinutes: 60,
        urgency: 'high',
      },
      response: {
        proposedSlots: [
          '2025-01-15T10:30:00.000Z',
          '2025-01-15T12:00:00.000Z',
          '2025-01-15T15:00:00.000Z',
        ],
        conflicts: [
          'alice: 2025-01-15T09:00:00Z – 2025-01-15T10:00:00Z',
          'charlie: 2025-01-15T09:30:00Z – 2025-01-15T10:30:00Z',
        ],
        reasoning:
          'Searched a 1-day window (urgency: high) across 3 attendee(s)\' ' +
          'working hours (9:00–18:00 UTC) and found 3 conflict-free slot(s).',
      },
    },
  })
  async findSlot(input: any, ctx: ExecutionContext) {
    ctx.logger.info('Finding meeting slot', {
      attendees: input.attendees,
      durationMinutes: input.durationMinutes,
      urgency: input.urgency,
    });

    const result = await findMeetingSlot({
      attendees: input.attendees,
      durationMinutes: input.durationMinutes,
      urgency: input.urgency,
    });

    ctx.logger.info('Slot search complete', {
      slotsFound: result.proposedSlots.length,
      conflictsFound: result.conflicts.length,
    });

    return result;
  }

  @Tool({
    name: 'book_meeting',
    description:
      'Book a previously proposed meeting slot for the given attendees. ' +
      'Validates the slot is a valid ISO date and attendees are non-empty, ' +
      'then confirms the booking with a unique meeting ID.',
    inputSchema: z.object({
      slot: z
        .string()
        .describe('ISO 8601 timestamp of the slot to book'),
      attendees: z
        .array(z.string())
        .min(1)
        .describe('List of attendee names for the meeting'),
    }),
    examples: {
      request: {
        slot: '2025-01-15T10:30:00.000Z',
        attendees: ['alice', 'bob'],
      },
      response: {
        confirmed: true,
        meetingId: 'meeting-1705312200000',
      },
    },
  })
  async book(input: any, ctx: ExecutionContext) {
    ctx.logger.info('Booking meeting', {
      slot: input.slot,
      attendees: input.attendees,
    });

    const result = await bookMeeting({
      slot: input.slot,
      attendees: input.attendees,
    });

    ctx.logger.info('Booking result', {
      confirmed: result.confirmed,
      meetingId: result.meetingId,
    });

    return result;
  }
}
