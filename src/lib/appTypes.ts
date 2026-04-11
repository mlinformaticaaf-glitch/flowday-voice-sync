export type Priority = 'alta' | 'media' | 'baixa';
export type Category = 'codigo' | 'comunicacao' | 'pesquisa' | 'geral';
export type TaskKind = 'task' | 'habit';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type SyncSource = 'manual' | 'voice' | 'google';
export type ProjectStatus = 'planejado' | 'em_andamento' | 'pausado' | 'concluido';

export interface Task {
  id: string;
  title: string;
  priority: Priority;
  category: Category;
  kind: TaskKind;
  recurrence: Recurrence;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  source: SyncSource;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  recurrence: Recurrence;
  source: SyncSource;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboxItem {
  id: string;
  text: string;
  source: SyncSource;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleConnection {
  connected: boolean;
  email: string | null;
  scope: string | null;
  needsReconnect: boolean;
  lastCalendarSyncAt: string | null;
  lastTasksSyncAt: string | null;
}

export interface HabitEntry {
  id: string;
  habitId: string;
  entryDate: string;
  value: number;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  progress: number;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}