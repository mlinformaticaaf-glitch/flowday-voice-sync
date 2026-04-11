import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { format, isToday, parseISO, isFuture, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Clock, AlertTriangle, Flame, FolderKanban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';

const PRIORITY_ORDER = { alta: 0, media: 1, baixa: 2 };
const PRIORITY_DOT: Record<string, string> = {
  alta: 'bg-priority-high',
  media: 'bg-priority-medium',
  baixa: 'bg-priority-low',
};

export default function DashboardView() {
  const { user } = useAuth();
  const { tasks, appointments, loading } = useAppStore();
  const taskItems = tasks.filter((task) => task.kind === 'task');
  const habitItems = tasks.filter((task) => task.kind === 'habit');
  const [habitEntries, setHabitEntries] = useState<Array<Tables<'habit_entries'>>>([]);
  const [projects, setProjects] = useState<Array<Tables<'projects'>>>([]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const pending = taskItems
    .filter((t) => !t.completed)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    .slice(0, 3);

  const upcoming = appointments
    .filter((a) => {
      const d = parseISO(a.date);
      return isToday(d) || isFuture(d);
    })
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 4);

  const completedToday = taskItems.filter((t) => t.completedAt?.startsWith(todayStr)).length;

  useEffect(() => {
    if (!user?.id) {
      setHabitEntries([]);
      setProjects([]);
      return;
    }

    let active = true;
    const weekStart = format(subDays(new Date(), 6), 'yyyy-MM-dd');

    void (async () => {
      const [entriesResponse, projectsResponse] = await Promise.all([
        supabase
          .from('habit_entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('entry_date', weekStart),
        supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false }),
      ]);

      if (!active) return;

      if (!entriesResponse.error) {
        setHabitEntries(entriesResponse.data ?? []);
      }

      if (!projectsResponse.error) {
        setProjects(projectsResponse.data ?? []);
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const habitsDoneToday = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const uniqueDone = new Set(habitEntries.filter((entry) => entry.entry_date === today).map((entry) => entry.habit_id));
    return uniqueDone.size;
  }, [habitEntries]);

  const activeProjects = useMemo(
    () => projects.filter((project) => project.status === 'em_andamento' || project.status === 'planejado'),
    [projects]
  );

  const averageProjectProgress = useMemo(() => {
    if (activeProjects.length === 0) return 0;
    const total = activeProjects.reduce((sum, project) => sum + project.progress, 0);
    return Math.round(total / activeProjects.length);
  }, [activeProjects]);

  const topProjects = useMemo(
    () => [...activeProjects].sort((left, right) => right.progress - left.progress).slice(0, 3),
    [activeProjects]
  );

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando dados...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="animate-in fade-in-0 slide-in-from-top-1 duration-200">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Bom dia 👋</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-4 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <AlertTriangle size={16} className="text-priority-high mb-1" />
          <p className="text-xl sm:text-2xl font-bold text-foreground">{taskItems.filter((t) => !t.completed && t.priority === 'alta').length}</p>
          <p className="text-[11px] text-muted-foreground">Alta prioridade</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 animate-in fade-in-0 slide-in-from-top-1 duration-200 [animation-delay:60ms]">
          <Clock size={16} className="text-primary mb-1" />
          <p className="text-xl sm:text-2xl font-bold text-foreground">{taskItems.filter((t) => !t.completed).length}</p>
          <p className="text-[11px] text-muted-foreground">Pendentes</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 animate-in fade-in-0 slide-in-from-top-1 duration-200 [animation-delay:120ms]">
          <CheckCircle2 size={16} className="text-primary mb-1" />
          <p className="text-xl sm:text-2xl font-bold text-foreground">{completedToday}</p>
          <p className="text-[11px] text-muted-foreground">Concluídas hoje</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in-0 slide-in-from-top-1 duration-200 [animation-delay:70ms]">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-primary" />
            <p className="text-sm font-semibold text-foreground">Hábitos</p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Hoje: <span className="text-foreground font-medium">{habitsDoneToday}</span> de {habitItems.length} hábitos concluídos
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Registros da semana: <span className="text-foreground font-medium">{habitEntries.length}</span>
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2">
            <FolderKanban size={16} className="text-primary" />
            <p className="text-sm font-semibold text-foreground">Projetos</p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Ativos: <span className="text-foreground font-medium">{activeProjects.length}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Progresso médio: <span className="text-foreground font-medium">{averageProjectProgress}%</span>
          </p>
        </div>
      </div>

      {/* Top 3 */}
      <div className="animate-in fade-in-0 slide-in-from-top-1 duration-200 [animation-delay:80ms]">
        <h2 className="text-sm font-semibold text-foreground mb-2">Prioridades do dia</h2>
        <div className="space-y-1">
          {pending.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tarefa pendente</p>}
          {pending.map((t, index) => (
            <div
              key={t.id}
              className="flex items-center gap-3 bg-card border border-border rounded-md px-3 py-2 animate-in fade-in-0 slide-in-from-top-1 duration-200"
              style={{ animationDelay: `${120 + index * 40}ms` }}
            >
              <div className={`w-2 h-2 rounded-full ${PRIORITY_DOT[t.priority]}`} />
              <span className="text-sm text-foreground truncate flex-1">{t.title}</span>
              {t.dueDate && <span className="text-[10px] text-muted-foreground">{t.dueDate}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming */}
      <div className="animate-in fade-in-0 slide-in-from-top-1 duration-200 [animation-delay:120ms]">
        <h2 className="text-sm font-semibold text-foreground mb-2">Próximos compromissos</h2>
        <div className="space-y-1">
          {upcoming.length === 0 && <p className="text-xs text-muted-foreground">Nenhum compromisso</p>}
          {upcoming.map((a, index) => (
            <div
              key={a.id}
              className="flex items-center gap-3 bg-card border border-border rounded-md px-3 py-2 animate-in fade-in-0 slide-in-from-top-1 duration-200"
              style={{ animationDelay: `${140 + index * 40}ms` }}
            >
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm text-foreground truncate flex-1">{a.title}</span>
              <span className="text-[10px] text-muted-foreground">{a.time} · {format(parseISO(a.date), 'd MMM', { locale: ptBR })}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="animate-in fade-in-0 slide-in-from-top-1 duration-200 [animation-delay:160ms]">
        <h2 className="text-sm font-semibold text-foreground mb-2">Projetos em destaque</h2>
        <div className="space-y-1">
          {topProjects.length === 0 && <p className="text-xs text-muted-foreground">Nenhum projeto ativo</p>}
          {topProjects.map((project) => (
            <div key={project.id} className="bg-card border border-border rounded-md px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground truncate">{project.name}</span>
                <span className="text-[10px] text-muted-foreground">{project.progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary mt-2 overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${project.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
