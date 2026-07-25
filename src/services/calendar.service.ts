import 'dotenv/config';
import localCalendar from "../resources/calendar.json";
import roster from "../resources/roster.json";

export interface BusyRange {
  start: string;
  end: string;
}

export interface PersonAvailability {
  busy: BusyRange[];
  workingHours: { start: string; end: string };
}

export type AvailabilityMap = Record<string, PersonAvailability>;

/**
 * Resolve a name or email into a full email address using roster.json lookup.
 * e.g., "Sumithra" -> "sumithra13022004@gmail.com"
 *       "Alice" -> "alice@company.com"
 *       "bob@acme.com" -> "bob@acme.com"
 */
export function resolveEmployeeEmail(input: string): string {
  const cleanInput = input.trim().toLowerCase();

  // 1. Match against roster.json members by name or email
  const member = roster.members.find(
    (m: any) =>
      m.name.toLowerCase() === cleanInput ||
      (m.email && m.email.toLowerCase() === cleanInput)
  );

  if (member && member.email) {
    return member.email.toLowerCase().trim();
  }

  // 2. If input already contains an '@', return it
  if (cleanInput.includes("@")) {
    return cleanInput;
  }

  // 3. Fallback domain mapping
  const domain = process.env.COMPANY_DOMAIN || "gmail.com";
  return `${cleanInput}@${domain}`;
}

/**
 * Extract clean name/key for fallback lookup.
 * e.g., "alice@company.com" -> "alice"
 */
export function extractUsername(emailOrName: string): string {
  return emailOrName.split("@")[0].toLowerCase().trim();
}

/**
 * Query live Google Calendar FreeBusy API for a list of employee emails.
 * Uses Node 18+ builtin fetch — no heavy SDK required.
 */
async function fetchGoogleFreeBusy(
  emails: string[],
  timeMin: string,
  timeMax: string,
  apiKey: string
): Promise<AvailabilityMap> {
  const url = `https://www.googleapis.com/calendar/v3/freeBusy?key=${apiKey}`;
  const body = {
    timeMin,
    timeMax,
    items: emails.map((e) => ({ id: e })),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Calendar API Error (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as any;
  const result: AvailabilityMap = {};

  for (const email of emails) {
    const calData = data.calendars?.[email];
    const busyBlocks: BusyRange[] = (calData?.busy ?? []).map((b: any) => ({
      start: b.start,
      end: b.end,
    }));

    const startW = process.env.WORKING_HOURS_START || "03:30:00Z";
    const endW = process.env.WORKING_HOURS_END || "12:30:00Z";

    result[email] = {
      busy: busyBlocks,
      workingHours: {
        start: `${timeMin.slice(0, 10)}T${startW}`,
        end: `${timeMin.slice(0, 10)}T${endW}`,
      },
    };
  }

  return result;
}

/**
 * Main Entry Point: Get availability for attendees.
 * - Tries Live Google Calendar API if GOOGLE_CALENDAR_API_KEY is configured in .env
 * - Gracefully falls back to local calendar.json fixture for offline dev & tests.
 */
export async function getAvailabilityForAttendees(
  attendeeInputs: string[],
  timeMin: string,
  timeMax: string
): Promise<{ availability: AvailabilityMap; isLive: boolean }> {
  const resolvedEmails = attendeeInputs.map(resolveEmployeeEmail);
  const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;

  if (apiKey) {
    try {
      const liveData = await fetchGoogleFreeBusy(
        resolvedEmails,
        timeMin,
        timeMax,
        apiKey
      );
      return { availability: liveData, isLive: true };
    } catch (err: any) {
      console.warn(`[CalendarService] Live API fetch failed, falling back to local data:`, err.message);
    }
  }

  // Fallback to local mock data (mapping emails/usernames)
  const mockData: AvailabilityMap = {};
  for (const input of attendeeInputs) {
    const email = resolveEmployeeEmail(input);
    const username = extractUsername(input);
    const fallbackPerson = (localCalendar as Record<string, PersonAvailability>)[username] || (localCalendar as Record<string, PersonAvailability>)["alice"];

    const startW = process.env.WORKING_HOURS_START || "03:30:00Z";
    const endW = process.env.WORKING_HOURS_END || "12:30:00Z";

    mockData[email] = {
      busy: fallbackPerson?.busy ?? [],
      workingHours: fallbackPerson?.workingHours ?? {
        start: `${timeMin.slice(0, 10)}T${startW}`,
        end: `${timeMin.slice(0, 10)}T${endW}`,
      },
    };
  }

  return { availability: mockData, isLive: false };
}
