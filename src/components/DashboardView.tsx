import { useAppStore } from '@/stores/useAppStore';
import { format, isToday, parseISO, isFuture } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

const PRIORITY_ORDER = { alta: 0, media: 1, baixa: 2 };
const PRIORITY_DOT: Record<string, string> = {
  alta: 'bg-priority-high',
  media: 'bg-priority-medium',
  baixa: 'bg-priority-low',
};

export default function DashboardView() {
  const { tasks, appointments } = useAppStore();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const pending = tasks
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

  const completedToday = tasks.filter((t) => t.completed && t.createdAt?.startsWith(todayStr)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Bom dia 👋</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <AlertTriangle size={16} className="text-priority-high mb-1" />
          <p className="text-2xl font-bold text-foreground">{tasks.filter((t) => !t.completed && t.priority === 'alta').length}</p>
          <p className="text-[11px] text-muted-foreground">Alta prioridade</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <Clock size={16} className="text-primary mb-1" />
          <p className="text-2xl font-bold text-foreground">{tasks.filter((t) => !t.completed).length}</p>
          <p className="text-[11px] text-muted-foreground">Pendentes</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <CheckCircle2 size={16} className="text-primary mb-1" />
          <p className="text-2xl font-bold text-foreground">{completedToday}</p>
          <p className="text-[11px] text-muted-foreground">Concluídas hoje</p>
        </div>
      </div>

      {/* Top 3 */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Prioridades do dia</h2>
        <div className="space-y-1">
          {pending.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tarefa pendente</p>}
          {pending.map((t) => (
            <div key={t.id} className="flex items-center gap-3 bg-card border border-border rounded-md px-3 py-2">
              <div className={`w-2 h-2 rounded-full ${PRIORITY_DOT[t.priority]}`} />
              <span className="text-sm text-foreground truncate flex-1">{t.title}</span>
              {t.dueDate && <span className="text-[10px] text-muted-foreground">{t.dueDate}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Próximos compromissos</h2>
        <div className="space-y-1">
          {upcoming.length === 0 && <p className="text-xs text-muted-foreground">Nenhum compromisso</p>}
          {upcoming.map((a) => (
            <div key={a.id} className="flex items-center gap-3 bg-card border border-border rounded-md px-3 py-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm text-foreground truncate flex-1">{a.title}</span>
              <span className="text-[10px] text-muted-foreground">{a.time} · {format(parseISO(a.date), 'd MMM', { locale: ptBR })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
