/** Default length of a booked consultation. Not configurable in this version. */
export const CONSULTATION_DURATION_MINUTES = 30;

export const GOOGLE_MEET_NEW_URL = 'https://meet.google.com/new';

function utcStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Opens Google Calendar's "create event" form with the slot filled in.
 *
 * This is a client-side template URL, not the Calendar API — no OAuth, and it
 * cannot mint a Meet room on its own. The lawyer pastes a Meet link when they
 * accept; that URL is included in the event details when present (TD-027).
 */
export function googleCalendarTemplateUrl(input: {
  title: string;
  start: Date;
  durationMinutes?: number;
  details: string;
  location?: string;
}): string {
  const minutes = input.durationMinutes ?? CONSULTATION_DURATION_MINUTES;
  const end = new Date(input.start.getTime() + minutes * 60_000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${utcStamp(input.start)}/${utcStamp(end)}`,
    details: input.details,
    location: input.location ?? 'Google Meet',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function formatAccraSlot(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Accra',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function isGoogleMeetUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    if (url.hostname !== 'meet.google.com') return false;
    const path = url.pathname.replace(/\/+$/, '');
    if (!path || path === '/new' || path === '/landing') return false;
    return true;
  } catch {
    return false;
  }
}
