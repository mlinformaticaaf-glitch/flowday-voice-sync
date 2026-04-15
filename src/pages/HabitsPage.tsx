import { useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { Flame, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/useAppStore';

type HabitEntryRow = Tables<'habit_entries'>;

import HabitCard from '@/components/HabitCard';

const HABIT_COLORS = ['#22c55e', '#14b8a6', '#f59e0b', '#ef4444', '#3b82f6'];

export default function HabitsPage() {
  const { user } = useAuth();
  const { tasks, addTask, deleteTask, loading } = useAppStore();
  const [entries, setEntries] = useState<HabitEntryRow[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');

  const habits = useMemo(() => tasks.filter((task) => task.kind === 'habit'), [tasks]);
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
        .gte('entry_date', format(subDays(new Date(), 84), 'yyyy-MM-dd'))
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
  }, [user?.id]);

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
          const heatColor = HABIT_COLORS[index % HABIT_COLORS.length];

          return (
            <div key={habit.id} className="animate-in fade-in-0 slide-in-from-top-1 duration-200" style={{ animationDelay: `${index * 50}ms` }}>
              <HabitCard
                habit={habit}
                entries={entries}
                today={today}
                onToggleToday={handleToggleToday}
                onDelete={handleDeleteHabit}
                heatColor={heatColor}
              />
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
