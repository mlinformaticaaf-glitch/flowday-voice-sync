import { useState } from 'react';
import { toast } from 'sonner';
import { useAppStore, Priority, Category, Recurrence, Task } from '@/stores/useAppStore';
import { Check, Trash2, Plus } from 'lucide-react';

const PRIORITY_COLORS: Record<Priority, string> = {
  alta: 'bg-priority-high/20 text-priority-high',
  media: 'bg-priority-medium/20 text-priority-medium',
  baixa: 'bg-priority-low/20 text-priority-low',
};

const CATEGORY_LABELS: Record<Category, string> = {
  codigo: 'Código',
  comunicacao: 'Comunicação',
  pesquisa: 'Pesquisa',
  geral: 'Geral',
};

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: 'Sem repetição',
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
};

export default function TaskList() {
  const { tasks, addTask, toggleTask, deleteTask, loading } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('media');
  const [category, setCategory] = useState<Category>('geral');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [dueDate, setDueDate] = useState('');

  const submit = async () => {
    if (!title.trim()) return;
    try {
      await addTask({
        title: title.trim(),
        priority,
        category,
        kind: 'task',
        recurrence,
        dueDate: dueDate || null,
      });
      setTitle('');
      setDueDate('');
      setRecurrence('none');
      setShowForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao criar tarefa.');
    }
  };

  const taskItems = tasks.filter((task) => task.kind === 'task');
  const pending = taskItems.filter((t) => !t.completed);
  const done = taskItems.filter((t) => t.completed);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando tarefas...</p>;
  }

  const renderTask = (t: Task) => (
    <div key={t.id} className="flex items-center gap-3 bg-secondary/50 rounded-md px-3 py-2 group">
      <button
        onClick={() => {
          void toggleTask(t.id).catch((error) => {
            toast.error(error instanceof Error ? error.message : 'Falha ao atualizar tarefa.');
          });
        }}
        className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
          t.completed ? 'bg-primary border-primary' : 'border-border hover:border-primary/50'
        }`}
      >
        {t.completed && <Check size={12} className="text-primary-foreground" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${t.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {t.title}
        </p>
        <div className="flex gap-2 mt-0.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[t.priority]}`}>
            {t.priority}
          </span>
          <span className="text-[10px] text-muted-foreground">{CATEGORY_LABELS[t.category]}</span>
          {t.recurrence !== 'none' && <span className="text-[10px] text-primary">{RECURRENCE_LABELS[t.recurrence]}</span>}
          {t.dueDate && <span className="text-[10px] text-muted-foreground">{t.dueDate}</span>}
        </div>
      </div>
      <button
        onClick={() => {
          void deleteTask(t.id).catch((error) => {
            toast.error(error instanceof Error ? error.message : 'Falha ao excluir tarefa.');
          });
        }}
        className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Tarefas</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-primary hover:text-primary/80 transition-colors"
        >
          <Plus size={18} />
        </button>
      </div>

      {showForm && (
        <div className="bg-secondary/50 rounded-lg p-3 space-y-2 border border-border">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Título da tarefa"
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          <div className="flex gap-2 flex-wrap">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground"
            >
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground"
            >
              <option value="codigo">Código</option>
              <option value="comunicacao">Comunicação</option>
              <option value="pesquisa">Pesquisa</option>
              <option value="geral">Geral</option>
            </select>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence)}
              className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground"
            >
              <option value="none">Sem repetição</option>
              <option value="daily">Diária</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground"
            />
            <button onClick={() => void submit()} className="bg-primary text-primary-foreground rounded-md px-3 py-1 text-xs font-medium">
              Criar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1">{pending.map(renderTask)}</div>

      {done.length > 0 && (
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            Concluídas ({done.length})
          </summary>
          <div className="space-y-1 mt-2">{done.map(renderTask)}</div>
        </details>
      )}
    </div>
  );
}
