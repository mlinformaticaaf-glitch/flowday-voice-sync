import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/stores/useAppStore';
import { isToday, parseISO, isFuture, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, CheckCircle2, Flame, Sun, Moon, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import type { Appointment } from '@/lib/appTypes';
import EventModal from './EventModal';

export default function DailyBriefing() {
  const { user } = useAuth();
  const { syncGoogle, tasks, appointments, googleConnection } = useAppStore();
  const [selectedEvent, setSelectedEvent] = useState<Appointment | null>(null);

  useQuery({
    queryKey: ['google-sync', user?.id],
    queryFn: async () => {
      if (googleConnection.connected && user?.id) {
        return syncGoogle();
      }
      return null;
    },
    refetchInterval: 300000,
    enabled: !!user?.id && !!googleConnection.connected,
  });

  const isNight = new Date().getHours() >= 18;
  const greeting = isNight ? 'Boa noite' : 'Bom dia';
  const headerIcon = isNight ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-400" />;

  const pendingTasks = tasks.filter((t) => t.kind === 'task' && !t.completed);
  const urgentTasks = pendingTasks.filter((t) => t.priority === 'alta').length;

  const upcomingAppointments = appointments
    .filter((a) => {
      const d = parseISO(a.date);
      return isToday(d) || isFuture(d);
    })
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 3);

  const nextAppointment = upcomingAppointments[0];

  const habitItems = tasks.filter((t) => t.kind === 'habit');
  const habitsDone = habitItems.filter((t) => t.completed).length;
  const habitsTotal = habitItems.length;
  const habitsPending = habitsTotal - habitsDone;
  const habitsProgress = habitsTotal === 0 ? 0 : Math.round((habitsDone / habitsTotal) * 100);

  return (
    <div className="w-full bg-card/80 backdrop-blur-md border border-white/5 rounded-2xl p-5 shadow-lg mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {headerIcon}
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {greeting}!
            </h2>
            <p className="text-xs text-muted-foreground capitalize">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-row justify-between items-stretch gap-3 mb-5">
        <div className="flex flex-col justify-center items-center bg-white/5 rounded-xl p-3 flex-1 h-[88px]">
          <div className="flex items-center gap-2 text-primary">
            <Calendar className="w-4 h-4" />
            <span className="text-xl font-bold">{upcomingAppointments.length}</span>
          </div>
          <span className="text-[10px] text-muted-foreground text-center mt-1">
            {nextAppointment ? `Próximo: ${nextAppointment.time}` : 'Compromissos hoje'}
          </span>
        </div>

        <div className="flex flex-col justify-center items-center bg-white/5 rounded-xl p-3 flex-1 relative overflow-hidden h-[88px]">
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xl font-bold">{pendingTasks.length}</span>
          </div>
          {urgentTasks > 0 && (
            <div className="absolute top-1 right-1">
              <span className="bg-red-500/20 text-red-400 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center justify-center leading-none">
                {urgentTasks} URG
              </span>
            </div>
          )}
          <span className="text-[10px] text-muted-foreground text-center mt-1">
            Tarefas Pendentes
          </span>
        </div>

        <div className="flex flex-col justify-center items-center bg-white/5 rounded-xl p-3 flex-1 h-[88px]">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-xl font-bold">{habitsPending}</span>
          </div>
          <div className="w-full h-[3px] bg-black/40 rounded-full overflow-hidden mt-1 max-w-[40px]">
            <div className="h-full bg-cyan-500 rounded-full transition-all duration-500" style={{ width: `${habitsProgress}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground text-center mt-1 line-clamp-1">
            Hábitos Restantes
          </span>
        </div>
      </div>

      <div className="h-px w-full bg-white/10 mb-4" />

      {upcomingAppointments.length > 0 ? (
        <div className="space-y-2 mb-4">
          <h3 className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wider">Próximos compromissos:</h3>
          {upcomingAppointments.map((app) => (
            <div 
              key={app.id} 
              onClick={() => setSelectedEvent(app)}
              className="flex items-center justify-between text-sm cursor-pointer hover:bg-white/5 p-1 -mx-1 rounded transition-colors"
            >
              <span className="text-foreground/90 truncate flex-1">{app.title}</span>
              <span className="text-primary font-medium">{app.time}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-4 text-sm text-muted-foreground text-center">Agenda livre por hoje!</div>
      )}

      <button
        type="button"
        className="w-full flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary transition-colors py-2.5 rounded-xl text-sm font-medium"
      >
        <Sparkles className="w-4 h-4" />
        Ver resumo completo por voz
      </button>

      <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
