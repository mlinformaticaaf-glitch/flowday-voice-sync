import { useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { Flame, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/useAppStore';

type HabitEntryRow = Tables<'habit_entries'>;

const HABIT_COLORS = ['#22c55e', '#14b8a6', '#f59e0b', '#ef4444', '#3b82f6'];

function getHabitWeeklyGoal(recurrence: 'none' | 'daily' | 'weekly' | 'monthly'): number {
  switch (recurrence) {
    case 'weekly':
      return 1;
    case 'monthly':
      return 1;
    case 'daily':
    case 'none':
    default:
      return 5;
  }
}

function getPastDays(totalDays: number): string[] {
  return Array.from({ length: totalDays }, (_, index) => format(subDays(new Date(), totalDays - index - 1), 'yyyy-MM-dd'));
}

function getHabitStreak(habitId: string, entries: HabitEntryRow[]): number {
  const lookup = new Set(entries.filter((entry) => entry.habit_id === habitId).map((entry) => entry.entry_date));
  let streak = 0;

  for (let day = 0; day < 365; day += 1) {
    const current = format(subDays(new Date(), day), 'yyyy-MM-dd');
    if (!lookup.has(current)) {
      break;
    }
    streak += 1;
  }

  return streak;
}

export default function HabitsPage() {
  const { user } = useAuth();
  const { tasks, addTask, deleteTask, loading } = useAppStore();
  const [entries, setEntries] = useState<HabitEntryRow[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');

  const habits = useMemo(() => tasks.filter((task) => task.kind === 'habit'), [tasks]);
  const days = useMemo(() => getPastDays(84), []);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!user?.id) {
      setEntries([]);
      setEntriesLoading(false);
      return;
    }

    let active = true;

    void (async () => {
      setEntriesLoading(true);
      const { data, error } = await supabase
        .from('habit_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('entry_date', days[0])
        .order('entry_date', { ascending: true });

      if (!active) return;

      if (error) {
        console.error('Failed to load habit entries', error);
        toast.error('Não foi possível carregar o progresso dos hábitos.');
        setEntriesLoading(false);
        return;
      }

      setEntries(data ?? []);
      setEntriesLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [days, user?.id]);

  const handleCreateHabit = async () => {
    if (!title.trim()) {
      toast.error('Informe o nome do hábito.');
      return;
    }

    try {
      await addTask({
        title: title.trim(),
        priority: 'media',
        category: 'geral',
        kind: 'habit',
        recurrence: 'daily',
        dueDate: null,
      });
      setTitle('');
      setShowForm(false);
      toast.success('Hábito criado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao criar hábito.');
    }
  };

  const handleToggleToday = async (habitId: string) => {
    if (!user?.id) return;

    const existing = entries.find((entry) => entry.habit_id === habitId && entry.entry_date === today);

    if (existing) {
      const { error } = await supabase.from('habit_entries').delete().eq('id', existing.id);
      if (error) {
        toast.error(error.message || 'Não foi possível atualizar o hábito.');
        return;
      }

      setEntries((current) => current.filter((entry) => entry.id !== existing.id));
      return;
    }

    const { data, error } = await supabase
      .from('habit_entries')
      .insert({ user_id: user.id, habit_id: habitId, entry_date: today, value: 1 })
      .select('*')
      .single();

    if (error || !data) {
      toast.error(error?.message || 'Não foi possível registrar o hábito.');
      return;
    }

    setEntries((current) => [...current, data]);
  };

  const handleDeleteHabit = async (habitId: string) => {
    try {
      await deleteTask(habitId);
      setEntries((current) => current.filter((entry) => entry.habit_id !== habitId));
      toast.success('Hábito removido.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao remover hábito.');
    }
  };

  if (loading || entriesLoading) {
    return <p className="text-sm text-muted-foreground">Carregando hábitos...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Hábitos</h1>
          <p className="text-sm text-muted-foreground">Acompanhe consistência diária com heatmap.</p>
        </div>
        <button onClick={() => setShowForm((current) => !current)} className="text-primary hover:text-primary/80 transition-colors">
          <Plus size={18} />
        </button>
      </div>

      {showForm && (
        <div className="bg-secondary/50 rounded-lg p-3 border border-border space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Nome do hábito"
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex flex-wrap gap-2 items-center">
            <p className="text-xs text-muted-foreground">Os hábitos criados aqui entram no acompanhamento diário com heatmap automático.</p>
            <button onClick={() => void handleCreateHabit()} className="ml-auto rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium">
              Criar hábito
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {habits.map((habit, index) => {
          const todayDone = entries.some((entry) => entry.habit_id === habit.id && entry.entry_date === today);
          const weeklyGoal = getHabitWeeklyGoal(habit.recurrence);
          const weeklyCount = entries.filter((entry) => entry.habit_id === habit.id && entry.entry_date >= format(subDays(new Date(), 6), 'yyyy-MM-dd')).length;
          const streak = getHabitStreak(habit.id, entries);
          const heatColor = HABIT_COLORS[index % HABIT_COLORS.length];

          return (
            <div key={habit.id} className="bg-card border border-border rounded-lg p-4 space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200" style={{ animationDelay: `${index * 50}ms` }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: heatColor }} />
                    <h2 className="text-sm font-semibold text-foreground">{habit.title}</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {weeklyCount}/{weeklyGoal} nesta semana · {streak} dias de sequência
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void handleToggleToday(habit.id)}
                    className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${todayDone ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground border border-border'}`}
                  >
                    <Flame size={13} />
                    {todayDone ? 'Feito hoje' : 'Marcar hoje'}
                  </button>
                  <button onClick={() => void handleDeleteHabit(habit.id)} className="text-muted-foreground hover:text-foreground">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="grid grid-flow-col grid-rows-7 gap-1 min-w-max">
                  {days.map((day) => {
                    const active = entries.some((entry) => entry.habit_id === habit.id && entry.entry_date === day);
                    return (
                      <div
                        key={`${habit.id}-${day}`}
                        className="w-3 h-3 rounded-[3px] border border-background/20"
                        style={{ backgroundColor: active ? heatColor : 'hsl(var(--muted))', opacity: active ? 1 : 0.45 }}
                        title={`${habit.title} · ${day}${active ? ' · concluído' : ''}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {habits.length === 0 && (
          <div className="bg-secondary/40 border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
            Nenhum hábito cadastrado ainda. Crie o primeiro e acompanhe sua consistência no heatmap.
          </div>
        )}
      </div>
    </div>
  );
}
