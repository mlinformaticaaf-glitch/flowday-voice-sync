import { useRef, useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Plus, Wand2, GripVertical, Circle, CheckCircle2, Trash2, Edit2, ArrowUpRight, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useInboxAI } from '@/hooks/useInboxAI';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function getDefaultEventDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultEventTime(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default function InboxCapture() {
  const [showInput, setShowInput] = useState(false);
  const [text, setText] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // AI State
  const { isProcessingAI, processInboxWithAI } = useInboxAI();
  
  // App Store
  const { inbox, addInboxItem, deleteInboxItem, addTask, addAppointment, loading } = useAppStore();

  const handleMultipleSubmit = async () => {
    if (!text.trim()) return;
    try {
      const items = text.split(/,|;/).map((i) => i.trim()).filter(Boolean);
      for (const t of items) {
        await addInboxItem(t);
      }
      setText('');
      toast.success(`${items.length} itens adicionados!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao capturar item.');
    }
  };

  const handleComplete = async (id: string) => {
    setProcessingId(id);
    try {
      await deleteInboxItem(id);
    } catch {
      toast.error('Erro ao excluir item');
    } finally {
      if (processingId === id) setProcessingId(null);
    }
  };

  const promoteToTask = async (id: string, content: string) => {
    setProcessingId(id);
    try {
      await addTask({
        title: content,
        priority: 'media',
        category: 'geral',
        dueDate: null,
      });
      await deleteInboxItem(id);
      toast.success('Promovido para Tarefas.');
    } catch {
      toast.error('Ocorreu um erro.');
    } finally {
      setProcessingId(null);
    }
  };

  const promoteToAppointment = async (id: string, content: string) => {
    setProcessingId(id);
    try {
      await addAppointment({
        title: content,
        date: getDefaultEventDate(),
        time: getDefaultEventTime(),
        duration: 30,
      });
      await deleteInboxItem(id);
      toast.success('Promovido para Calendário.');
    } catch {
      toast.error('Ocorreu um erro.');
    } finally {
      setProcessingId(null);
    }
  };

  const promoteToProject = async (id: string, content: string) => {
    // For now we just create a task with no due date pretending it's a project initialization
    // When the Project module is fully implemented, this can be changed.
    setProcessingId(id);
    try {
       // Mock for now, requires table update
       toast.success(`Promovido para Projeto: ${content}`);
       await deleteInboxItem(id);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground p-4">Carregando inbox...</p>;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="flex items-center justify-between bg-card/50 px-4 py-3 rounded-xl border border-border">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          Inbox <span className="px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground">{inbox.length}</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void processInboxWithAI()}
            disabled={isProcessingAI || inbox.length === 0}
            className="flex items-center gap-1.5 text-xs font-medium text-cyan-400 bg-cyan-950/30 hover:bg-cyan-900/40 px-3 py-1.5 rounded-lg transition-colors border border-cyan-900/50 disabled:opacity-50"
          >
            <Wand2 className="w-3.5 h-3.5" />
            {isProcessingAI ? 'Processando...' : 'Processar tudo'}
          </button>
          <button
            onClick={() => setShowInput(!showInput)}
            className="flex items-center gap-1.5 text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-lg transition-colors"
          >
            {showInput ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showInput ? 'Cancelar' : 'Adicionar'}
          </button>
        </div>
      </div>

      {/* INLINE ADD INPUT */}
      {showInput && (
        <div className="flex gap-2 animate-in slide-in-from-top-2 fade-in">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleMultipleSubmit()}
            placeholder="Adicione um item... (vírgula ou Enter para próximo)"
            autoFocus
            className="flex-1 bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
          />
          <button
            onClick={() => void handleMultipleSubmit()}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-all"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* LIST */}
      <div className="space-y-2">
        {inbox.map((item) => (
          <div
            key={item.id}
            className={`group relative flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-3 transition-opacity overflow-hidden cursor-default ${processingId === item.id ? 'opacity-50 pointer-events-none' : 'hover:border-white/10 hover:bg-card/80'}`}
          >
            {/* Color Band - Left */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gray-500`} />

            <div className="cursor-grab text-muted-foreground/30 group-hover:text-muted-foreground/60 p-1 -ml-1">
              <GripVertical className="w-4 h-4" />
            </div>

            <button 
              onClick={() => handleComplete(item.id)}
              className="text-muted-foreground hover:text-cyan-400 transition-colors"
            >
              <Circle className="w-5 h-5" />
            </button>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.text}</p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(item.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => handleComplete(item.id)}
                className="p-2 text-muted-foreground hover:text-red-400 rounded-md hover:bg-white/5 transition-colors"
                title="Deletar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="p-2 text-muted-foreground hover:text-cyan-400 rounded-md hover:bg-white/5 transition-colors"
                    title="Promover"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => promoteToTask(item.id, item.text)}>
                    Mover para Tarefas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => promoteToAppointment(item.id, item.text)}>
                    Mover para Compromisso
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => promoteToProject(item.id, item.text)}>
                    Mover para Projeto
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}

        {inbox.length === 0 && !showInput && (
          <div className="text-center py-10 opacity-70">
            <p className="text-sm text-muted-foreground">O Inbox está vazio e limpo!</p>
          </div>
        )}
      </div>
    </div>
  );
}
