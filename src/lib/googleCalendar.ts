import type { Appointment } from '@/lib/appTypes';

function formatUtcTimestamp(date: string, time: string): string {
  const value = new Date(`${date}T${time}:00`);
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function getGoogleCalendarUrl(appointment: Pick<Appointment, 'title' | 'date' | 'time' | 'duration' | 'source' | 'externalId'>): string {
  if (appointment.source === 'google' && appointment.externalId) {
    const searchUrl = new URL('https://calendar.google.com/calendar/u/0/r/search');
    searchUrl.searchParams.set('q', appointment.title);
    return searchUrl.toString();
  }

  const start = formatUtcTimestamp(appointment.date, appointment.time);
  const endDate = new Date(new Date(`${appointment.date}T${appointment.time}:00`).getTime() + appointment.duration * 60000);
  const end = endDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

  const url = new URL('https://calendar.google.com/calendar/u/0/r/eventedit');
  url.searchParams.set('text', appointment.title);
  url.searchParams.set('dates', `${start}/${end}`);
  return url.toString();
}
