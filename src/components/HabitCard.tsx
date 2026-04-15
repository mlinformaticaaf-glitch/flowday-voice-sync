import { useMemo } from 'react';
import { Check, Trash2, Circle } from 'lucide-react';
import { format, subDays } from 'date-fns';
import type { Task } from '@/lib/appTypes';
import type { Tables } from '@/integrations/supabase/types';

type HabitEntryRow = Tables<'habit_entries'>;

interface HabitCardProps {
  habit: Task;
  entries: HabitEntryRow[];
  today: string;
  onToggleToday: (habitId: string) => void;
  onDelete: (habitId: string) => void;
  heatColor: string;
}

function getHabitWeeklyGoal(recurrence: string): number {
  switch (recurrence) {
    case 'weekly': return 1;
    case 'monthly': return 1;
    case 'daily':
    case 'none':
    default: return 5;
  }
}

function getHabitStreak(habitId: string, entries: HabitEntryRow[]): number {
  const lookup = new Set(entries.filter((entry) => entry.habit_id === habitId).map((entry) => entry.entry_date));
  let streak = 0;
  for (let day = 0; day < 365; day += 1) {
    const current = format(subDays(new Date(), day), 'yyyy-MM-dd');
    if (!lookup.has(current)) break;
    streak += 1;
  }
  return streak;
}

function getStreakColor(streak: number) {
  if (streak === 0) return 'bg-gray-600/50';
  if (streak <= 5) return 'bg-blue-500';
  if (streak <= 20) return 'bg-orange-500';
  return 'bg-purple-500';
}

function HabitHeatmap({ habitId, entries, heatColor }: { habitId: string, entries: HabitEntryRow[], heatColor: string }) {
  const days = useMemo(() => Array.from({ length: 84 }, (_, index) => format(subDays(new Date(), 84 - index - 1), 'yyyy-MM-dd')), []);
  return (
    <div className="overflow-x-auto mt-4 pb-2">
      <div className="grid grid-flow-col grid-rows-7 gap-1 min-w-max">
        {days.map((day) => {
          const active = entries.some((entry) => entry.habit_id === habitId && entry.entry_date === day);
          return (
            <div
              key={`${habitId}-${day}`}
              className="w-[11px] h-[11px] rounded-sm transition-all"
              style={{ backgroundColor: active ? heatColor : 'hsl(var(--muted)/0.3)', opacity: active ? 1 : 0.8 }}
              title={active ? `Concluído em ${day}` : day}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function HabitCard({ habit, entries, today, onToggleToday, onDelete, heatColor }: HabitCardProps) {
  const todayDone = entries.some((entry) => entry.habit_id === habit.id && entry.entry_date === today);
  const weeklyGoal = getHabitWeeklyGoal(habit.recurrence);
  const weeklyCount = entries.filter((entry) => entry.habit_id === habit.id && entry.entry_date >= format(subDays(new Date(), 6), 'yyyy-MM-dd')).length;
  const streak = getHabitStreak(habit.id, entries);
  const streakColor = getStreakColor(streak);

  return (
    <div className="relative bg-card/60 backdrop-blur-sm border border-border/60 rounded-2xl p-4 overflow-hidden group hover:border-white/10 hover:bg-card/80 transition-all shadow-sm">
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${streakColor} transition-colors`} />

      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground tracking-tight">{habit.title}</h2>
            <button onClick={() => onDelete(habit.id)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
              <Trash2 size={14} />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Meta: {weeklyCount}/{weeklyGoal} esta semana <span className="opacity-50 mx-1">|</span> <span className={streak >= 21 ? 'text-purple-400 font-bold' : streak >= 6 ? 'text-orange-400 font-medium' : ''}>{streak} dias seguidos {streak >= 21 && '🔥'}</span>
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 pl-2 border-l border-border/40">
          <button
            onClick={() => onToggleToday(habit.id)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm hover:scale-105 active:scale-95 ${todayDone ? 'bg-gradient-to-tr from-cyan-600 to-cyan-400 text-white border-none shadow-cyan-500/20' : 'bg-secondary text-muted-foreground border border-border hover:text-cyan-400 hover:border-cyan-500/30'}`}
          >
            {todayDone ? <Check size={18} strokeWidth={3} /> : <Circle size={18} strokeWidth={2} />}
          </button>
          <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground group-hover:text-foreground/70 transition-colors">
            Hoje
          </span>
        </div>
      </div>

      <div className="pl-2">
         <HabitHeatmap habitId={habit.id} entries={entries} heatColor={heatColor} />
      </div>
    </div>
  );
}
