import 'dotenv/config';
import localCalendar from "../resources/calendar.json";
import roster from "../resources/roster.json";
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

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

async function sendEtherealInvite(attendees: string[], summary: string, startTime: string) {
  try {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, 
      auth: {
        user: testAccount.user, 
        pass: testAccount.pass, 
      },
    });

    const info = await transporter.sendMail({
      from: '"NitroStack Scheduler" <scheduler@nitrostack.com>',
      to: attendees.join(', '),
      subject: `Meeting Invite: ${summary}`,
      text: `You have been invited to ${summary} at ${startTime}.`,
      html: `<b>You have been invited to ${summary} at ${startTime}.</b>`
    });

    console.log(`[CalendarService] 📧 Email invites sent to attendees! Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  } catch (e) {
    console.error("[CalendarService] Failed to send mock email invite", e);
  }
}

/**
 * Attempts to book a meeting via Google Calendar events.insert API.
 * Uses a Service Account JSON file if present, otherwise falls back.
 */
export async function bookGoogleCalendarEvent(
  attendees: string[],
  startTime: string,
  endTime: string,
  summary: string = "Scheduled Meeting"
): Promise<{ confirmed: boolean; meetingId: string; live: boolean }> {
  
  const keyFilePath = path.join(process.cwd(), '.data', 'google-credentials.json');
  
  // ALWAYS send out email invites to attendees (using mock Ethereal mail so it works in dev)
  await sendEtherealInvite(attendees, summary, startTime);

  if (fs.existsSync(keyFilePath)) {
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: keyFilePath,
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
      });

      const calendar = google.calendar({ version: 'v3', auth });

      const res = await calendar.events.insert({
        calendarId: 'primary', // Note: Make sure the Service Account has been shared to the target calendar
        requestBody: {
          summary,
          description: `Attendees: ${attendees.join(', ')}`,
          start: { dateTime: startTime },
          end: { dateTime: endTime },
          // We omit 'attendees' because standard Service Accounts cannot invite 
          // others without Google Workspace Domain-Wide Delegation of Authority.
        }
      });

      if (res.data && res.data.id) {
        return { confirmed: true, meetingId: res.data.id, live: true };
      }
    } catch (err: any) {
      console.warn(`[CalendarService] Live API insert failed via Service Account:`, err.message);
    }
  } else {
    console.warn(`[CalendarService] .data/google-credentials.json not found. Falling back to mock booking.`);
  }

  // Fallback to local booking if API call fails or no credentials file
  return {
    confirmed: true,
    meetingId: `mock-meeting-${Date.now()}-${attendees[0]?.split("@")[0] || "unknown"}`,
    live: false,
  };
}
