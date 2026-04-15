import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Appointment } from '@/lib/appTypes';
import { useAppStore } from '@/stores/useAppStore';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { CalendarIcon, Clock, Edit2, Trash2 } from 'lucide-react';

interface EventModalProps {
  event: Appointment | null;
  onClose: () => void;
}

export default function EventModal({ event, onClose }: EventModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Appointment>>({});
  const { updateAppointment, deleteAppointment } = useAppStore();

  useEffect(() => {
    if (event) {
      setIsEditing(false);
      setDraft({
        title: event.title,
        date: event.date,
        time: event.time,
        duration: event.duration,
      });
    }
  }, [event]);

  // Dialog controlled behavior using its internal state mapping
  if (!event) return null;

  const handleSave = async () => {
    try {
      await updateAppointment(event.id, draft);
      toast.success('Evento atualizado com sucesso.');
      onClose();
    } catch (e) {
      toast.error('Erro ao atualizar evento.');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAppointment(event.id);
      toast.success('Evento deletado.');
      onClose();
    } catch (e) {
      toast.error('Erro ao deletar evento.');
    }
  };

  const isGoogle = event.source === 'google';

  return (
    <Dialog open={!!event} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader className="flex flex-row items-center justify-between mt-2">
          <div className="flex flex-col gap-1">
            <DialogTitle className="text-xl font-semibold">
              {isEditing ? 'Editar Evento' : event.title}
            </DialogTitle>
            <div className="flex items-center gap-2 mt-1">
              {isGoogle ? (
                <span className="bg-green-500/20 text-green-400 text-[10px] uppercase px-2 py-0.5 rounded-full font-bold">
                  🟢 Google Agenda
                </span>
              ) : (
                <span className="bg-cyan-500/20 text-cyan-400 text-[10px] uppercase px-2 py-0.5 rounded-full font-bold">
                  🔵 FlowDay
                </span>
              )}
            </div>
          </div>
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-cyan-400">
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </DialogHeader>

        <div className="py-4">
          {isEditing ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Título</label>
                <input
                  value={draft.title || ''}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Data</label>
                  <input
                    type="date"
                    value={draft.date || ''}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Hora</label>
                  <input
                    type="time"
                    value={draft.time || ''}
                    onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 text-secondary-foreground">
                  <div className="p-2 bg-secondary rounded-lg">
                    <CalendarIcon className="w-4 h-4 text-cyan-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium capitalize">{format(parseISO(event.date), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
                    <p className="text-xs text-muted-foreground">Data do compromisso</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-secondary-foreground">
                  <div className="p-2 bg-secondary rounded-lg">
                    <Clock className="w-4 h-4 text-cyan-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{event.time} ({event.duration} min)</p>
                    <p className="text-xs text-muted-foreground">Horário e duração</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center sm:justify-between border-t border-border pt-4">
          <button
            onClick={handleDelete}
            className="text-red-400 hover:text-red-300 text-sm font-medium flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-950/30 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </button>
          
          <div className="flex items-center gap-2 mt-4 sm:mt-0">
            <button
              onClick={() => {
                if (isEditing) setIsEditing(false);
                else onClose();
              }}
              className="px-4 py-2 text-sm font-medium hover:bg-secondary rounded-lg text-muted-foreground transition-colors"
            >
              Cancelar
            </button>
            {isEditing && (
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Salvar
              </button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
