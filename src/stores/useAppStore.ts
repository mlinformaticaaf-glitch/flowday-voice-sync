import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Priority = 'alta' | 'media' | 'baixa';
export type Category = 'codigo' | 'comunicacao' | 'pesquisa' | 'geral';

export interface Task {
  id: string;
  title: string;
  priority: Priority;
  category: Category;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
}

export interface Appointment {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: number; // minutes
  createdAt: string;
}

export interface InboxItem {
  id: string;
  text: string;
  createdAt: string;
}

interface AppState {
  tasks: Task[];
  appointments: Appointment[];
  inbox: InboxItem[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'completed'>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  addAppointment: (apt: Omit<Appointment, 'id' | 'createdAt'>) => void;
  deleteAppointment: (id: string) => void;
  addInboxItem: (text: string) => void;
  deleteInboxItem: (id: string) => void;
}

const genId = () => crypto.randomUUID();

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      tasks: [],
      appointments: [],
      inbox: [],

      addTask: (task) =>
        set((s) => ({
          tasks: [
            { ...task, id: genId(), completed: false, createdAt: new Date().toISOString() },
            ...s.tasks,
          ],
        })),

      toggleTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
        })),

      deleteTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      addAppointment: (apt) =>
        set((s) => ({
          appointments: [
            { ...apt, id: genId(), createdAt: new Date().toISOString() },
            ...s.appointments,
          ],
        })),

      deleteAppointment: (id) =>
        set((s) => ({ appointments: s.appointments.filter((a) => a.id !== id) })),

      addInboxItem: (text) =>
        set((s) => ({
          inbox: [
            { id: genId(), text, createdAt: new Date().toISOString() },
            ...s.inbox,
          ],
        })),

      deleteInboxItem: (id) =>
        set((s) => ({ inbox: s.inbox.filter((i) => i.id !== id) })),
    }),
    { name: 'flowday-storage' }
  )
);
