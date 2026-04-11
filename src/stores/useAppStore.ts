import { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import type {
  Appointment,
  Category,
  GoogleConnection,
  InboxItem,
  Priority,
  Recurrence,
  SyncSource,
  Task,
  TaskKind,
} from '@/lib/appTypes';
import {
  createGoogleCalendarEvent,
  createGoogleTask,
  deleteGoogleCalendarEvent,
  deleteGoogleTask,
  fetchGoogleCalendarAppointments,
  fetchGoogleTasks,
  GoogleReconnectRequiredError,
  type GoogleTokenBundle,
  updateGoogleTaskCompletion,
} from '@/lib/googleSync';
import { GOOGLE_PRODUCTIVITY_SCOPES } from '@/lib/googleOAuth';
import { defaultDueDateForRecurrence, getNextDueDate, isRecurring } from '@/lib/recurrence';

export type { Appointment, Category, InboxItem, Priority, Recurrence, Task, TaskKind } from '@/lib/appTypes';

type TaskRow = Tables<'tasks'>;
type TaskInsert = TablesInsert<'tasks'>;
type TaskUpdate = TablesUpdate<'tasks'>;
type AppointmentRow = Tables<'appointments'>;
type AppointmentInsert = TablesInsert<'appointments'>;
type AppointmentUpdate = TablesUpdate<'appointments'>;
type InboxRow = Tables<'inbox_items'>;
type GoogleIntegrationRow = Tables<'google_integrations'>;
type GoogleIntegrationInsert = TablesInsert<'google_integrations'>;

export interface CreateTaskInput {
  title: string;
  priority: Priority;
  category: Category;
  dueDate: string | null;
  kind?: TaskKind;
  recurrence?: Recurrence;
  source?: SyncSource;
}

export interface CreateAppointmentInput {
  title: string;
  date: string;
  time: string;
  duration: number;
  recurrence?: Recurrence;
  source?: SyncSource;
}

interface AppState {
  userId: string | null;
  initialized: boolean;
  loading: boolean;
  syncingGoogle: boolean;
  tasks: Task[];
  appointments: Appointment[];
  inbox: InboxItem[];
  googleConnection: GoogleConnection;
  initialize: (userId: string) => Promise<void>;
  clear: () => void;
  saveGoogleSession: (session: Session | null) => Promise<void>;
  disconnectGoogle: () => Promise<void>;
  syncGoogle: () => Promise<{ tasks: number; appointments: number }>;
  addTask: (task: CreateTaskInput) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addAppointment: (appointment: CreateAppointmentInput) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  addInboxItem: (text: string, source?: SyncSource) => Promise<void>;
  deleteInboxItem: (id: string) => Promise<void>;
}

const emptyGoogleConnection: GoogleConnection = {
  connected: false,
  email: null,
  scope: null,
  needsReconnect: false,
  lastCalendarSyncAt: null,
  lastTasksSyncAt: null,
};

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((left, right) => {
    if (left.completed !== right.completed) {
      return left.completed ? 1 : -1;
    }

    if (left.kind !== right.kind) {
      return left.kind === 'habit' ? -1 : 1;
    }

    const leftDue = left.dueDate ?? '9999-12-31';
    const rightDue = right.dueDate ?? '9999-12-31';
    if (leftDue !== rightDue) {
      return leftDue.localeCompare(rightDue);
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

function sortAppointments(appointments: Appointment[]): Appointment[] {
  return [...appointments].sort((left, right) => `${left.date}${left.time}`.localeCompare(`${right.date}${right.time}`));
}

function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    priority: row.priority as Priority,
    category: row.category as Category,
    kind: row.kind as TaskKind,
    recurrence: row.recurrence as Recurrence,
    dueDate: row.due_date,
    completed: row.completed,
    completedAt: row.completed_at,
    source: row.source as SyncSource,
    externalId: row.external_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAppointmentRow(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    time: row.time,
    duration: row.duration,
    recurrence: row.recurrence as Recurrence,
    source: row.source as SyncSource,
    externalId: row.external_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInboxRow(row: InboxRow): InboxItem {
  return {
    id: row.id,
    text: row.text,
    source: row.source as SyncSource,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGoogleConnection(row: GoogleIntegrationRow | null): GoogleConnection {
  if (!row) {
    return emptyGoogleConnection;
  }

  return {
    connected: row.connected && Boolean(row.access_token),
    email: row.email,
    scope: row.scope,
    needsReconnect: row.connected && !row.access_token,
    lastCalendarSyncAt: row.last_calendar_sync_at,
    lastTasksSyncAt: row.last_tasks_sync_at,
  };
}

async function loadSnapshot(userId: string) {
  const [tasksResponse, appointmentsResponse, inboxResponse, googleResponse] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('appointments').select('*').eq('user_id', userId).order('date', { ascending: true }).order('time', { ascending: true }),
    supabase.from('inbox_items').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('google_integrations').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  if (tasksResponse.error) throw tasksResponse.error;
  if (appointmentsResponse.error) throw appointmentsResponse.error;
  if (inboxResponse.error) throw inboxResponse.error;
  if (googleResponse.error) throw googleResponse.error;

  return {
    tasks: sortTasks((tasksResponse.data ?? []).map(mapTaskRow)),
    appointments: sortAppointments((appointmentsResponse.data ?? []).map(mapAppointmentRow)),
    inbox: (inboxResponse.data ?? []).map(mapInboxRow),
    googleConnection: mapGoogleConnection(googleResponse.data ?? null),
  };
}

async function readGoogleTokens(userId: string): Promise<GoogleTokenBundle | null> {
  const { data, error } = await supabase
    .from('google_integrations')
    .select('access_token, refresh_token, token_expires_at, email, scope, connected')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.connected || !data.access_token) return null;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: data.token_expires_at,
    email: data.email,
    scope: data.scope,
  };
}

function requireUserId(userId: string | null): string {
  if (!userId) {
    throw new Error('Usuário não autenticado.');
  }

  return userId;
}

function buildTaskInsert(userId: string, task: CreateTaskInput): TaskInsert {
  const kind = task.kind ?? 'task';
  const recurrence = kind === 'habit'
    ? task.recurrence && task.recurrence !== 'none' ? task.recurrence : 'daily'
    : task.recurrence ?? 'none';

  return {
    user_id: userId,
    title: task.title.trim(),
    priority: task.priority,
    category: task.category,
    kind,
    recurrence,
    due_date: task.dueDate ?? defaultDueDateForRecurrence(recurrence),
    completed: false,
    completed_at: null,
    source: task.source ?? 'manual',
  };
}

function buildAppointmentInsert(userId: string, appointment: CreateAppointmentInput): AppointmentInsert {
  return {
    user_id: userId,
    title: appointment.title.trim(),
    date: appointment.date,
    time: appointment.time,
    duration: appointment.duration,
    recurrence: appointment.recurrence ?? 'none',
    source: appointment.source ?? 'manual',
  };
}

const initialState = {
  userId: null,
  initialized: false,
  loading: false,
  syncingGoogle: false,
  tasks: [] as Task[],
  appointments: [] as Appointment[],
  inbox: [] as InboxItem[],
  googleConnection: emptyGoogleConnection,
};

export const useAppStore = create<AppState>()((set, get) => ({
  ...initialState,

  initialize: async (userId) => {
    set({ loading: true, userId });

    try {
      const snapshot = await loadSnapshot(userId);
      set({ ...snapshot, loading: false, initialized: true, userId });
    } catch (error) {
      console.error('Failed to initialize app store', error);
      set({ loading: false, initialized: false });
      throw error;
    }
  },

  clear: () => set({ ...initialState }),

  saveGoogleSession: async (session) => {
    if (!session?.user || session.user.app_metadata.provider !== 'google') {
      return;
    }

    const userId = session.user.id;
    const providerSession = session as Session & {
      provider_token?: string;
      provider_refresh_token?: string;
    };

    const currentTokens = await supabase
      .from('google_integrations')
      .select('refresh_token, scope, access_token, connected, last_calendar_sync_at, last_tasks_sync_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (currentTokens.error) {
      throw currentTokens.error;
    }

    const payload: GoogleIntegrationInsert = {
      user_id: userId,
      email: session.user.email ?? null,
      access_token: providerSession.provider_token ?? currentTokens.data?.access_token ?? null,
      refresh_token: providerSession.provider_refresh_token ?? currentTokens.data?.refresh_token ?? null,
      scope: currentTokens.data?.scope ?? GOOGLE_PRODUCTIVITY_SCOPES.join(' '),
      token_expires_at: providerSession.provider_token ? new Date(Date.now() + 55 * 60 * 1000).toISOString() : null,
      connected: Boolean(providerSession.provider_token ?? currentTokens.data?.access_token),
      last_calendar_sync_at: currentTokens.data?.last_calendar_sync_at ?? null,
      last_tasks_sync_at: currentTokens.data?.last_tasks_sync_at ?? null,
    };

    const { error } = await supabase.from('google_integrations').upsert(payload, { onConflict: 'user_id' });
    if (error) throw error;

    set((state) => ({
      googleConnection: {
        ...state.googleConnection,
        connected: Boolean(payload.connected),
        email: payload.email ?? null,
        scope: payload.scope ?? null,
        needsReconnect: false,
      },
    }));
  },

  disconnectGoogle: async () => {
    const userId = requireUserId(get().userId);
    const { error } = await supabase
      .from('google_integrations')
      .update({ connected: false, access_token: null, refresh_token: null, token_expires_at: null })
      .eq('user_id', userId);

    if (error) throw error;
    set({ googleConnection: emptyGoogleConnection });
  },

  syncGoogle: async () => {
    const userId = requireUserId(get().userId);
    set({ syncingGoogle: true });

    try {
      const tokens = await readGoogleTokens(userId);
      if (!tokens) {
        throw new Error('Conecte novamente sua conta Google para sincronizar.');
      }

      const [googleTasks, googleAppointments] = await Promise.all([
        fetchGoogleTasks(tokens.accessToken),
        fetchGoogleCalendarAppointments(tokens.accessToken),
      ]);

      if (googleTasks.length > 0) {
        const { error } = await supabase.from('tasks').upsert(
          googleTasks.map((task) => ({
            user_id: userId,
            title: task.title,
            priority: task.priority,
            category: task.category,
            kind: task.kind,
            recurrence: task.recurrence,
            due_date: task.dueDate,
            completed: task.completed,
            completed_at: task.completedAt,
            source: 'google',
            external_id: task.externalId,
          })),
          { onConflict: 'user_id,external_id' }
        );

        if (error) throw error;
      }

      if (googleAppointments.length > 0) {
        const { error } = await supabase.from('appointments').upsert(
          googleAppointments.map((appointment) => ({
            user_id: userId,
            title: appointment.title,
            date: appointment.date,
            time: appointment.time,
            duration: appointment.duration,
            recurrence: appointment.recurrence,
            source: 'google',
            external_id: appointment.externalId,
          })),
          { onConflict: 'user_id,external_id' }
        );

        if (error) throw error;
      }

      const syncedAt = new Date().toISOString();
      const { error: integrationError } = await supabase
        .from('google_integrations')
        .update({
          last_calendar_sync_at: syncedAt,
          last_tasks_sync_at: syncedAt,
          connected: true,
        })
        .eq('user_id', userId);

      if (integrationError) throw integrationError;

      const snapshot = await loadSnapshot(userId);
      set({ ...snapshot, initialized: true, userId, syncingGoogle: false });
      return { tasks: googleTasks.length, appointments: googleAppointments.length };
    } catch (error) {
      if (error instanceof GoogleReconnectRequiredError) {
        set((state) => ({
          syncingGoogle: false,
          googleConnection: {
            ...state.googleConnection,
            connected: false,
            needsReconnect: true,
          },
        }));
      } else {
        set({ syncingGoogle: false });
      }

      throw error;
    }
  },

  addTask: async (taskInput) => {
    const userId = requireUserId(get().userId);
    const insertPayload = buildTaskInsert(userId, taskInput);

    const { data, error } = await supabase.from('tasks').insert(insertPayload).select('*').single();
    if (error || !data) throw error ?? new Error('Falha ao criar tarefa.');

    let nextRow = data;
    const shouldMirrorToGoogle = data.kind === 'task';

    if (shouldMirrorToGoogle) {
      const tokens = await readGoogleTokens(userId);
      if (tokens?.accessToken) {
        try {
          const externalId = await createGoogleTask(tokens.accessToken, mapTaskRow(data));
          if (externalId) {
            const { data: updatedRow, error: updateError } = await supabase
              .from('tasks')
              .update({ external_id: externalId } satisfies TaskUpdate)
              .eq('id', data.id)
              .select('*')
              .single();

            if (updateError) throw updateError;
            if (updatedRow) nextRow = updatedRow;
          }
        } catch (error) {
          if (error instanceof GoogleReconnectRequiredError) {
            set((state) => ({
              googleConnection: {
                ...state.googleConnection,
                connected: false,
                needsReconnect: true,
              },
            }));
          } else {
            console.error('Failed to mirror task to Google Tasks', error);
          }
        }
      }
    }

    set((state) => ({ tasks: sortTasks([mapTaskRow(nextRow), ...state.tasks]) }));
  },

  toggleTask: async (id) => {
    const userId = requireUserId(get().userId);
    const currentTask = get().tasks.find((task) => task.id === id);
    if (!currentTask) return;

    const tokens = currentTask.externalId ? await readGoogleTokens(userId) : null;
    const completedAt = new Date().toISOString();

    let updatePayload: TaskUpdate;
    if (!currentTask.completed && isRecurring(currentTask.recurrence)) {
      const nextDueDate = getNextDueDate(currentTask.dueDate, currentTask.recurrence);
      let nextExternalId = currentTask.externalId;

      if (currentTask.externalId && tokens?.accessToken && currentTask.kind === 'task') {
        try {
          await updateGoogleTaskCompletion(tokens.accessToken, currentTask.externalId, true);
          nextExternalId = await createGoogleTask(tokens.accessToken, {
            ...currentTask,
            dueDate: nextDueDate,
          });
        } catch (error) {
          if (error instanceof GoogleReconnectRequiredError) {
            set((state) => ({
              googleConnection: {
                ...state.googleConnection,
                connected: false,
                needsReconnect: true,
              },
            }));
          } else {
            console.error('Failed to advance recurring Google task', error);
          }
        }
      }

      updatePayload = {
        due_date: nextDueDate,
        completed: false,
        completed_at: completedAt,
        external_id: nextExternalId ?? null,
      };
    } else {
      const nextCompleted = !currentTask.completed;
      if (currentTask.externalId && tokens?.accessToken) {
        try {
          await updateGoogleTaskCompletion(tokens.accessToken, currentTask.externalId, nextCompleted);
        } catch (error) {
          if (error instanceof GoogleReconnectRequiredError) {
            set((state) => ({
              googleConnection: {
                ...state.googleConnection,
                connected: false,
                needsReconnect: true,
              },
            }));
          } else {
            console.error('Failed to update Google task completion', error);
          }
        }
      }

      updatePayload = {
        completed: nextCompleted,
        completed_at: nextCompleted ? completedAt : null,
      };
    }

    const { data, error } = await supabase.from('tasks').update(updatePayload).eq('id', id).select('*').single();
    if (error || !data) throw error ?? new Error('Falha ao atualizar tarefa.');

    const updatedTask = mapTaskRow(data);
    set((state) => ({
      tasks: sortTasks(state.tasks.map((task) => (task.id === id ? updatedTask : task))),
    }));
  },

  deleteTask: async (id) => {
    const userId = requireUserId(get().userId);
    const currentTask = get().tasks.find((task) => task.id === id);
    if (!currentTask) return;

    if (currentTask.externalId) {
      const tokens = await readGoogleTokens(userId);
      if (tokens?.accessToken) {
        try {
          await deleteGoogleTask(tokens.accessToken, currentTask.externalId);
        } catch (error) {
          if (error instanceof GoogleReconnectRequiredError) {
            set((state) => ({
              googleConnection: {
                ...state.googleConnection,
                connected: false,
                needsReconnect: true,
              },
            }));
          } else {
            console.error('Failed to delete Google task', error);
          }
        }
      }
    }

    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;

    set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) }));
  },

  addAppointment: async (appointmentInput) => {
    const userId = requireUserId(get().userId);
    const insertPayload = buildAppointmentInsert(userId, appointmentInput);

    const { data, error } = await supabase.from('appointments').insert(insertPayload).select('*').single();
    if (error || !data) throw error ?? new Error('Falha ao criar compromisso.');

    let nextRow = data;
    const tokens = await readGoogleTokens(userId);
    if (tokens?.accessToken) {
      try {
        const externalId = await createGoogleCalendarEvent(tokens.accessToken, mapAppointmentRow(data));
        if (externalId) {
          const { data: updatedRow, error: updateError } = await supabase
            .from('appointments')
            .update({ external_id: externalId } satisfies AppointmentUpdate)
            .eq('id', data.id)
            .select('*')
            .single();

          if (updateError) throw updateError;
          if (updatedRow) nextRow = updatedRow;
        }
      } catch (error) {
        if (error instanceof GoogleReconnectRequiredError) {
          set((state) => ({
            googleConnection: {
              ...state.googleConnection,
              connected: false,
              needsReconnect: true,
            },
          }));
        } else {
          console.error('Failed to mirror appointment to Google Calendar', error);
        }
      }
    }

    set((state) => ({ appointments: sortAppointments([mapAppointmentRow(nextRow), ...state.appointments]) }));
  },

  deleteAppointment: async (id) => {
    const userId = requireUserId(get().userId);
    const currentAppointment = get().appointments.find((appointment) => appointment.id === id);
    if (!currentAppointment) return;

    if (currentAppointment.externalId) {
      const tokens = await readGoogleTokens(userId);
      if (tokens?.accessToken) {
        try {
          await deleteGoogleCalendarEvent(tokens.accessToken, currentAppointment.externalId);
        } catch (error) {
          if (error instanceof GoogleReconnectRequiredError) {
            set((state) => ({
              googleConnection: {
                ...state.googleConnection,
                connected: false,
                needsReconnect: true,
              },
            }));
          } else {
            console.error('Failed to delete Google Calendar event', error);
          }
        }
      }
    }

    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) throw error;

    set((state) => ({ appointments: state.appointments.filter((appointment) => appointment.id !== id) }));
  },

  addInboxItem: async (text, source = 'manual') => {
    const userId = requireUserId(get().userId);
    const { data, error } = await supabase
      .from('inbox_items')
      .insert({ user_id: userId, text: text.trim(), source })
      .select('*')
      .single();

    if (error || !data) throw error ?? new Error('Falha ao adicionar item na inbox.');

    set((state) => ({ inbox: [mapInboxRow(data), ...state.inbox] }));
  },

  deleteInboxItem: async (id) => {
    const { error } = await supabase.from('inbox_items').delete().eq('id', id);
    if (error) throw error;

    set((state) => ({ inbox: state.inbox.filter((item) => item.id !== id) }));
  },
}));
