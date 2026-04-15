import type { Appointment, Category, Priority, Recurrence, Task, TaskKind } from '@/lib/appTypes';

export class GoogleReconnectRequiredError extends Error {
  constructor(message = 'Reconecte sua conta Google para continuar sincronizando.') {
    super(message);
    this.name = 'GoogleReconnectRequiredError';
  }
}

export interface GoogleTokenBundle {
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  email: string | null;
  scope: string | null;
}

interface GoogleCalendarEvent {
  id: string;
  status?: string;
  summary?: string;
  recurrence?: string[];
  start?: {
    date?: string;
    dateTime?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
  };
}

interface GoogleCalendarResponse {
  items?: GoogleCalendarEvent[];
}

interface GoogleTaskItem {
  id: string;
  title?: string;
  due?: string;
  status?: 'needsAction' | 'completed';
  completed?: string;
}

interface GoogleTasksResponse {
  items?: GoogleTaskItem[];
}

function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function getTaskNotes(task: Pick<Task, 'priority' | 'category' | 'recurrence' | 'kind'>): string | undefined {
  const notes = [
    `prioridade:${task.priority}`,
    `categoria:${task.category}`,
    `recorrencia:${task.recurrence}`,
    `tipo:${task.kind}`,
  ];

  return notes.join('\n');
}

function recurrenceToRRule(recurrence: Recurrence): string[] | undefined {
  switch (recurrence) {
    case 'daily':
      return ['RRULE:FREQ=DAILY'];
    case 'weekly':
      return ['RRULE:FREQ=WEEKLY'];
    case 'monthly':
      return ['RRULE:FREQ=MONTHLY'];
    default:
      return undefined;
  }
}

function parseGoogleRecurrence(recurrence?: string[]): Recurrence {
  const joined = recurrence?.join(' ').toUpperCase() ?? '';
  if (joined.includes('FREQ=DAILY')) return 'daily';
  if (joined.includes('FREQ=WEEKLY')) return 'weekly';
  if (joined.includes('FREQ=MONTHLY')) return 'monthly';
  return 'none';
}

function toGoogleTaskDueDate(dueDate: string | null): string | undefined {
  if (!dueDate) return undefined;
  return `${dueDate}T23:59:00.000Z`;
}

function toGoogleDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

async function fetchGoogleJson<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new GoogleReconnectRequiredError();
  }

  if (!response.ok) {
    throw new Error(`Google API falhou (${response.status}): ${await response.text()}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchGoogleCalendarAppointments(accessToken: string): Promise<Array<Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>>> {
  const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('maxResults', '250');

  const payload = await fetchGoogleJson<GoogleCalendarResponse>(url.toString(), accessToken);

  return (payload.items ?? [])
    .filter((event) => event.id && event.status !== 'cancelled' && (event.start?.date || event.start?.dateTime))
    .map((event) => {
      const startDateTime = event.start?.dateTime ?? null;
      const endDateTime = event.end?.dateTime ?? null;
      const date = startDateTime ? startDateTime.slice(0, 10) : event.start?.date ?? new Date().toISOString().slice(0, 10);
      const time = startDateTime ? startDateTime.slice(11, 16) : '09:00';
      const duration = startDateTime && endDateTime
        ? Math.max(15, Math.round((new Date(endDateTime).getTime() - new Date(startDateTime).getTime()) / 60000))
        : 60;

      return {
        title: event.summary?.trim() || 'Compromisso do Google Calendar',
        date,
        time,
        duration,
        recurrence: parseGoogleRecurrence(event.recurrence),
        source: 'google' as const,
        externalId: event.id,
      };
    });
}

export async function fetchGoogleTasks(accessToken: string): Promise<Array<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>> {
  const url = new URL('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks');
  url.searchParams.set('showCompleted', 'true');
  url.searchParams.set('showHidden', 'false');
  url.searchParams.set('maxResults', '250');

  const payload = await fetchGoogleJson<GoogleTasksResponse>(url.toString(), accessToken);

  return (payload.items ?? [])
    .filter((item) => item.id && item.title)
    .map((item) => ({
      title: item.title?.trim() || 'Tarefa do Google Tasks',
      priority: 'media' as Priority,
      category: 'geral' as Category,
      kind: 'task' as TaskKind,
      recurrence: 'none' as Recurrence,
      dueDate: item.due ? item.due.slice(0, 10) : null,
      completed: item.status === 'completed',
      completedAt: item.completed ?? null,
      source: 'google' as const,
      externalId: item.id,
    }));
}

export async function createGoogleTask(accessToken: string, task: Pick<Task, 'title' | 'dueDate' | 'priority' | 'category' | 'recurrence' | 'kind'>): Promise<string | null> {
  const payload = await fetchGoogleJson<GoogleTaskItem>('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      title: task.title,
      due: toGoogleTaskDueDate(task.dueDate),
      notes: getTaskNotes(task),
    }),
  });

  return payload.id ?? null;
}

export async function updateGoogleTaskCompletion(accessToken: string, externalId: string, completed: boolean): Promise<void> {
  await fetchGoogleJson(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${externalId}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(completed ? {
      status: 'completed',
      completed: new Date().toISOString(),
    } : {
      status: 'needsAction',
    }),
  });
}

export async function deleteGoogleTask(accessToken: string, externalId: string): Promise<void> {
  await fetchGoogleJson(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${externalId}`, accessToken, {
    method: 'DELETE',
  });
}

export async function createGoogleCalendarEvent(accessToken: string, appointment: Pick<Appointment, 'title' | 'date' | 'time' | 'duration' | 'recurrence'>): Promise<string | null> {
  const start = toGoogleDateTime(appointment.date, appointment.time);
  const end = new Date(new Date(start).getTime() + appointment.duration * 60000).toISOString();
  const payload = await fetchGoogleJson<GoogleCalendarEvent>('https://www.googleapis.com/calendar/v3/calendars/primary/events', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      summary: appointment.title,
      start: {
        dateTime: start,
        timeZone: getLocalTimeZone(),
      },
      end: {
        dateTime: end,
        timeZone: getLocalTimeZone(),
      },
      recurrence: recurrenceToRRule(appointment.recurrence),
    }),
  });

  return payload.id ?? null;
}

export async function deleteGoogleCalendarEvent(accessToken: string, externalId: string): Promise<void> {
  await fetchGoogleJson(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${externalId}`, accessToken, {
    method: 'DELETE',
  });
}

export async function updateGoogleCalendarEvent(accessToken: string, externalId: string, appointment: Partial<Pick<Appointment, 'title' | 'date' | 'time' | 'duration' | 'recurrence'>>): Promise<void> {
  const body: any = {};
  if (appointment.title) body.summary = appointment.title;
  
  if (appointment.date && appointment.time && appointment.duration !== undefined) {
    const start = toGoogleDateTime(appointment.date, appointment.time);
    const end = new Date(new Date(start).getTime() + appointment.duration * 60000).toISOString();
    body.start = { dateTime: start, timeZone: getLocalTimeZone() };
    body.end = { dateTime: end, timeZone: getLocalTimeZone() };
  }

  if (appointment.recurrence) {
    const rrule = recurrenceToRRule(appointment.recurrence);
    if (rrule) {
      body.recurrence = rrule;
    } else {
      body.recurrence = null;
    }
  }

  await fetchGoogleJson(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${externalId}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}