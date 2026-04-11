import { useRef, useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

function getDefaultEventDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultEventTime(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

interface EventDraft {
  title: string;
  date: string;
  time: string;
  duration: number;
}

export default function InboxCapture() {
  const [text, setText] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [closingEventId, setClosingEventId] = useState<string | null>(null);
  const [eventDraft, setEventDraft] = useState<EventDraft | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const { inbox, addInboxItem, deleteInboxItem, addTask, addAppointment, loading } = useAppStore();

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    try {
      await addInboxItem(t);
      setText('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao capturar item.');
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando inbox...</p>;
  }

  const handleAddAsTask = async (id: string, content: string) => {
    setProcessingId(id);
    try {
      await addTask({
        title: content,
        priority: 'media',
        category: 'geral',
        dueDate: null,
        kind: 'task',
        recurrence: 'none',
      });
      await deleteInboxItem(id);
      toast.success('Item enviado para tarefas.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao criar tarefa a partir da inbox.');
    } finally {
      setProcessingId(null);
    }
  };

  const openEventEditor = (id: string, content: string) => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setClosingEventId(null);
    setEditingEventId(id);
    setEventDraft({
      title: content,
      date: getDefaultEventDate(),
      time: getDefaultEventTime(),
      duration: 30,
    });
  };

  const cancelEventEditor = (id?: string) => {
    const targetId = id ?? editingEventId;
    if (!targetId) {
      return;
    }

    setClosingEventId(targetId);
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      setEditingEventId((current) => (current === targetId ? null : current));
      setClosingEventId((current) => (current === targetId ? null : current));
      setEventDraft((current) => (editingEventId === targetId ? null : current));
      closeTimerRef.current = null;
    }, 180);
  };

  const handleSaveEvent = async (id: string) => {
    if (!eventDraft || editingEventId !== id) {
      return;
    }

    const title = eventDraft.title.trim();
    if (!title) {
      toast.error('Informe um titulo para o evento.');
      return;
    }

    if (!eventDraft.date) {
      toast.error('Informe uma data para o evento.');
      return;
    }

    if (!eventDraft.time) {
      toast.error('Informe um horario para o evento.');
      return;
    }

    setProcessingId(id);
    try {
      await addAppointment({
        title,
        date: eventDraft.date,
        time: eventDraft.time,
        duration: eventDraft.duration,
        recurrence: 'none',
      });
      await deleteInboxItem(id);
      setEditingEventId(null);
      setClosingEventId(null);
      setEventDraft(null);
      toast.success('Evento criado com sucesso.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao criar evento a partir da inbox.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDiscard = async (id: string) => {
    setProcessingId(id);
    try {
      await deleteInboxItem(id);
      if (editingEventId === id) {
        setEditingEventId(null);
        setClosingEventId(null);
        setEventDraft(null);
      }
      toast.success('Item descartado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao descartar item da inbox.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="Capturar ideia rápida..."
          className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={() => void submit()}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors min-h-10"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="space-y-1">
        {inbox.map((item) => {
          const isEditingEvent = editingEventId === item.id;
          const isClosingEvent = closingEventId === item.id;
          const isProcessing = processingId === item.id;

          return (
          <div key={item.id} className="bg-secondary/50 rounded-md px-3 py-2.5 text-sm">
            <p className="text-secondary-foreground">{item.text}</p>
            <div className="mt-2 grid grid-cols-1 sm:flex sm:flex-wrap gap-2">
              <button
                onClick={() => void handleAddAsTask(item.id, item.text)}
                disabled={isProcessing}
                className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-medium hover:bg-primary/90 disabled:opacity-60 min-h-10"
              >
                Adicionar ao Google Tarefas
              </button>
              <button
                onClick={() => {
                  if (isEditingEvent) {
                    cancelEventEditor(item.id);
                    return;
                  }
                  openEventEditor(item.id, item.text);
                }}
                disabled={isProcessing}
                className="rounded-md bg-card border border-border text-foreground px-3 py-2 text-xs font-medium hover:bg-surface-hover disabled:opacity-60 min-h-10"
              >
                {isEditingEvent ? 'Cancelar evento' : 'Criar evento'}
              </button>
              <button
                onClick={() => void handleDiscard(item.id)}
                disabled={isProcessing}
                className="rounded-md bg-transparent border border-border text-muted-foreground px-3 py-2 text-xs font-medium hover:text-foreground hover:bg-surface-hover disabled:opacity-60 min-h-10"
              >
                Descartar
              </button>
            </div>

            {isEditingEvent && eventDraft && (
              <div
                className={`mt-3 rounded-md border border-border bg-card p-3 space-y-3 duration-200 ${
                  isClosingEvent
                    ? 'animate-out fade-out-0 slide-out-to-top-1'
                    : 'animate-in fade-in-0 slide-in-from-top-1'
                }`}
              >
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Titulo</label>
                  <input
                    value={eventDraft.title}
                    onChange={(e) => setEventDraft((prev) => prev ? { ...prev, title: e.target.value } : prev)}
                    className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Titulo do evento"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Data</label>
                    <input
                      type="date"
                      value={eventDraft.date}
                      onChange={(e) => setEventDraft((prev) => prev ? { ...prev, date: e.target.value } : prev)}
                      className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Hora</label>
                    <input
                      type="time"
                      value={eventDraft.time}
                      onChange={(e) => setEventDraft((prev) => prev ? { ...prev, time: e.target.value } : prev)}
                      className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Duracao</label>
                    <select
                      value={eventDraft.duration}
                      onChange={(e) => {
                        const duration = Number(e.target.value);
                        setEventDraft((prev) => prev ? { ...prev, duration } : prev);
                      }}
                      className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>60 min</option>
                      <option value={90}>90 min</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void handleSaveEvent(item.id)}
                    disabled={isProcessing}
                    className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-medium hover:bg-primary/90 disabled:opacity-60 min-h-10"
                  >
                    Salvar evento
                  </button>
                  <button
                    onClick={() => cancelEventEditor(item.id)}
                    disabled={isProcessing}
                    className="rounded-md border border-border text-muted-foreground px-3 py-2 text-xs font-medium hover:text-foreground hover:bg-surface-hover disabled:opacity-60 min-h-10"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
          );
        })}
        {inbox.length === 0 && (
          <p className="text-muted-foreground text-xs text-center py-4">Inbox vazio — capture algo!</p>
        )}
      </div>
    </div>
  );
}
