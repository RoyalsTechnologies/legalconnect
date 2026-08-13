import { describe, expect, it } from 'vitest';
import { googleCalendarTemplateUrl, isGoogleMeetUrl } from '../src/lib/google-calendar.js';

describe('Google Calendar / Meet helpers (FR-019)', () => {
  it('builds a Google Calendar template URL for the booked slot', () => {
    const url = googleCalendarTemplateUrl({
      title: 'Consultation: Kofi and Akua',
      start: new Date('2026-08-20T14:00:00.000Z'),
      details: 'Join with Google Meet: https://meet.google.com/abc-defg-hij',
      location: 'https://meet.google.com/abc-defg-hij',
    });

    expect(url.startsWith('https://calendar.google.com/calendar/render?')).toBe(true);
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('20260820T140000Z');
    expect(url).toContain('20260820T143000Z');
  });

  it('accepts a Meet room URL and rejects /new', () => {
    expect(isGoogleMeetUrl('https://meet.google.com/abc-defg-hij')).toBe(true);
    expect(isGoogleMeetUrl('https://meet.google.com/new')).toBe(false);
    expect(isGoogleMeetUrl('https://zoom.us/j/123')).toBe(false);
  });
});
