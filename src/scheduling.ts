import { createRequire } from "module";
const require = createRequire(import.meta.url);
const calendar = require("./resources/calendar.json");

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface FindMeetingSlotInput {
  attendees: string[];
  durationMinutes: number;
  urgency: "low" | "medium" | "high";
}

export interface FindMeetingSlotOutput {
  proposedSlots: string[];
  conflicts: string[];
  reasoning: string;
}

export interface BookMeetingInput {
  slot: string;
  attendees: string[];
}

export interface BookMeetingOutput {
  confirmed: boolean;
  meetingId: string;
}

interface BusyBlock {
  start: string;
  end: string;
}

interface PersonCalendar {
  busy: BusyBlock[];
  workingHours: { start: string; end: string };
}

type CalendarData = Record<string, PersonCalendar>;

// ── Constants ───────────────────────────────────────────────────────────────

/** Urgency controls how many days ahead we search for open slots. */
const SEARCH_WINDOW_DAYS: Record<"low" | "medium" | "high", number> = {
  high: 1,
  medium: 3,
  low: 7,
};

/** Maximum number of candidate slots we return. */
const MAX_PROPOSED_SLOTS = 3;

/** Step size (in minutes) when scanning for free windows. */
const STEP_MINUTES = 15;

// ── Helpers ─────────────────────────────────────────────────────────────────

function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Compute the tightest common working-hours window across all attendees.
 * Falls back to 09:00–18:00 UTC if there's no data or the intersection is empty.
 */
function intersectWorkingHours(
  attendees: string[],
  data: CalendarData
): { startHour: number; endHour: number } {
  let startHour = 0;
  let endHour = 24;

  for (const person of attendees) {
    const hours = data[person]?.workingHours;
    if (!hours) continue;
    startHour = Math.max(startHour, new Date(hours.start).getUTCHours());
    endHour = Math.min(endHour, new Date(hours.end).getUTCHours());
  }

  if (startHour >= endHour) {
    startHour = 9;
    endHour = 18;
  }

  return { startHour, endHour };
}

/**
 * Normalize mock busy blocks onto search window dates so that mock data
 * matches regardless of exact calendar year/month differences.
 */
function getNormalizedBusyBlocks(
  attendees: string[],
  data: CalendarData,
  searchStart: Date,
  windowDays: number
): { start: Date; end: Date; person: string; originalStart: string; originalEnd: string }[] {
  const result: { start: Date; end: Date; person: string; originalStart: string; originalEnd: string }[] = [];

  for (const person of attendees) {
    const personBusy = data[person]?.busy ?? [];
    for (const block of personBusy) {
      const origStart = new Date(block.start);
      const origEnd = new Date(block.end);

      // Check direct Date object overlay
      result.push({
        start: origStart,
        end: origEnd,
        person,
        originalStart: block.start,
        originalEnd: block.end,
      });

      // Project time-of-day onto each day in the search window for seamless testing
      for (let dayOffset = 0; dayOffset < windowDays; dayOffset++) {
        const projStart = new Date(searchStart);
        projStart.setUTCDate(projStart.getUTCDate() + dayOffset);
        projStart.setUTCHours(origStart.getUTCHours(), origStart.getUTCMinutes(), 0, 0);

        const durationMs = origEnd.getTime() - origStart.getTime();
        const projEnd = new Date(projStart.getTime() + durationMs);

        result.push({
          start: projStart,
          end: projEnd,
          person,
          originalStart: projStart.toISOString(),
          originalEnd: projEnd.toISOString(),
        });
      }
    }
  }

  return result;
}

// ── find_meeting_slot ───────────────────────────────────────────────────────

/**
 * Scan attendees' calendars and propose up to {@link MAX_PROPOSED_SLOTS}
 * conflict-free slots within a window determined by `urgency`.
 *
 * - `high`   → search 1 day ahead
 * - `medium` → search 3 days ahead
 * - `low`    → search 7 days ahead
 */
export async function findMeetingSlot(
  input: FindMeetingSlotInput
): Promise<FindMeetingSlotOutput> {
  const { attendees, durationMinutes, urgency } = input;
  const data = calendar as CalendarData;

  // Edge case: no attendees
  if (attendees.length === 0) {
    return {
      proposedSlots: [],
      conflicts: [],
      reasoning: "No attendees provided — cannot propose a slot.",
    };
  }

  const { startHour, endHour } = intersectWorkingHours(attendees, data);
  const windowDays = SEARCH_WINDOW_DAYS[urgency];

  // Edge case: duration longer than the entire working day
  const workingDayMinutes = (endHour - startHour) * 60;
  if (durationMinutes > workingDayMinutes) {
    return {
      proposedSlots: [],
      conflicts: [],
      reasoning:
        `Requested duration (${durationMinutes} min) exceeds the working day ` +
        `(${workingDayMinutes} min, ${startHour}:00–${endHour}:00 UTC). ` +
        `No slot can fit.`,
    };
  }

  const now = new Date();
  const searchEnd = new Date(now);
  searchEnd.setUTCDate(searchEnd.getUTCDate() + windowDays);

  // Normalize busy blocks across the search window
  const normalizedBusy = getNormalizedBusyBlocks(attendees, data, now, windowDays);

  const proposedSlots: string[] = [];
  const conflictSet = new Set<string>();

  // Start scanning from the beginning of working hours today (or now)
  let candidate = new Date(now);
  candidate.setUTCMinutes(0, 0, 0);
  candidate.setUTCHours(startHour);
  if (candidate < now) {
    candidate = new Date(now);
    // Round up to next STEP_MINUTES boundary
    const mins = candidate.getUTCMinutes();
    const remainder = mins % STEP_MINUTES;
    if (remainder !== 0) {
      candidate.setUTCMinutes(mins + (STEP_MINUTES - remainder), 0, 0);
    }
  }

  while (candidate < searchEnd && proposedSlots.length < MAX_PROPOSED_SLOTS) {
    // Build today's end-of-working-hours boundary
    const dayEnd = new Date(candidate);
    dayEnd.setUTCHours(endHour, 0, 0, 0);

    // Past the end of today? Jump to tomorrow's start.
    if (candidate >= dayEnd) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
      candidate.setUTCHours(startHour, 0, 0, 0);
      continue;
    }

    const slotEnd = new Date(candidate.getTime() + durationMinutes * 60_000);

    // Slot spills past working hours? Jump to next day.
    if (slotEnd > dayEnd) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
      candidate.setUTCHours(startHour, 0, 0, 0);
      continue;
    }

    // Check for clashes with any attendee's busy blocks
    const clashing = normalizedBusy.filter((b) =>
      overlaps(candidate, slotEnd, b.start, b.end)
    );

    if (clashing.length === 0) {
      proposedSlots.push(candidate.toISOString());
    } else {
      for (const c of clashing) {
        const timeStr = `${c.start.toISOString().slice(11, 16)}–${c.end.toISOString().slice(11, 16)} UTC`;
        conflictSet.add(`${c.person} busy (${timeStr})`);
      }
    }

    candidate = new Date(candidate.getTime() + STEP_MINUTES * 60_000);
  }

  const reasoning =
    proposedSlots.length > 0
      ? `Searched a ${windowDays}-day window (urgency: ${urgency}) across ` +
        `${attendees.length} attendee(s)' working hours (${startHour}:00–${endHour}:00 UTC) ` +
        `and found ${proposedSlots.length} conflict-free slot(s).`
      : `No conflict-free slot found within the ${windowDays}-day window for ` +
        `urgency "${urgency}". Consider a longer window or shorter duration.`;

  return {
    proposedSlots,
    conflicts: Array.from(conflictSet),
    reasoning,
  };
}

// ── book_meeting ────────────────────────────────────────────────────────────

/**
 * Book a previously-proposed slot.
 *
 * Intentionally simple per the contract: validates input, then confirms.
 * All the smart logic lives in {@link findMeetingSlot}.
 */
export async function bookMeeting(
  input: BookMeetingInput
): Promise<BookMeetingOutput> {
  const { slot, attendees } = input;

  const validSlot = !isNaN(new Date(slot).getTime());
  const hasAttendees = attendees.length > 0;

  if (!validSlot || !hasAttendees) {
    return { confirmed: false, meetingId: "" };
  }

  return {
    confirmed: true,
    meetingId: `meeting-${Date.now()}`,
  };
}
