import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';

type View = 'dia' | 'semana';

export default function AgendaView() {
  const { appointments, addAppointment, deleteAppointment } = useAppStore();
  const [view, setView] = useState<View>('dia');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);

  const prev = () => setCurrentDate((d) => addDays(d, view === 'dia' ? -1 : -7));
  const next = () => setCurrentDate((d) => addDays(d, view === 'dia' ? 1 : 7));

  const submit = () => {
    if (!title.trim()) return;
    addAppointment({ title: title.trim(), date: format(currentDate, 'yyyy-MM-dd'), time, duration });
    setTitle('');
    setShowForm(false);
  };

  const days = view === 'dia'
    ? [currentDate]
    : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(currentDate, { locale: ptBR }), i));

  const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07-20

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prev} className="text-muted-foreground hover:text-foreground"><ChevronLeft size={18} /></button>
          <h2 className="text-lg font-semibold text-foreground">
            {view === 'dia'
              ? format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })
              : `Semana de ${format(days[0], "d MMM", { locale: ptBR })}`}
          </h2>
          <button onClick={next} className="text-muted-foreground hover:text-foreground"><ChevronRight size={18} /></button>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-secondary rounded-md overflow-hidden text-xs">
            <button
              onClick={() => setView('dia')}
              className={`px-3 py-1 ${view === 'dia' ? 'bg-primary text-primary-foreground' : 'text-secondary-foreground'}`}
            >Dia</button>
            <button
              onClick={() => setView('semana')}
              className={`px-3 py-1 ${view === 'semana' ? 'bg-primary text-primary-foreground' : 'text-secondary-foreground'}`}
            >Semana</button>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="text-primary"><Plus size={18} /></button>
        </div>
      </div>

      {showForm && (
        <div className="bg-secondary/50 rounded-lg p-3 space-y-2 border border-border">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Título do compromisso"
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          <div className="flex gap-2">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground" />
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
              className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground">
              <option value={30}>30min</option>
              <option value={60}>1h</option>
              <option value={90}>1h30</option>
              <option value={120}>2h</option>
            </select>
            <button onClick={submit} className="bg-primary text-primary-foreground rounded-md px-3 py-1 text-xs font-medium">
              Criar
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className={`grid ${view === 'semana' ? 'grid-cols-8' : 'grid-cols-2'} min-w-[600px]`}>
          {/* Header */}
          <div className="text-[10px] text-muted-foreground p-1" />
          {days.map((d) => (
            <div key={d.toISOString()} className="text-xs text-center text-muted-foreground p-1 border-l border-border">
              {format(d, view === 'semana' ? 'EEE d' : 'EEEE', { locale: ptBR })}
            </div>
          ))}

          {/* Hours */}
          {HOURS.map((h) => (
            <>
              <div key={`h-${h}`} className="text-[10px] text-muted-foreground p-1 text-right pr-2 border-t border-border">
                {String(h).padStart(2, '0')}:00
              </div>
              {days.map((d) => {
                const dayAppts = appointments.filter(
                  (a) => isSameDay(parseISO(a.date), d) && parseInt(a.time.split(':')[0]) === h
                );
                return (
                  <div key={`${d.toISOString()}-${h}`} className="border-l border-t border-border min-h-[2.5rem] p-0.5 relative">
                    {dayAppts.map((a) => (
                      <div
                        key={a.id}
                        className="bg-primary/15 border-l-2 border-primary rounded-sm px-1.5 py-0.5 text-[10px] text-foreground group flex items-center justify-between"
                      >
                        <span className="truncate">{a.time} {a.title}</span>
                        <button
                          onClick={() => deleteAppointment(a.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground ml-1"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
