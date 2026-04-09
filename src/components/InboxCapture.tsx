import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Plus, X } from 'lucide-react';

export default function InboxCapture() {
  const [text, setText] = useState('');
  const { inbox, addInboxItem, deleteInboxItem } = useAppStore();

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    addInboxItem(t);
    setText('');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Capturar ideia rápida..."
          className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={submit}
          className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="space-y-1">
        {inbox.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between bg-secondary/50 rounded-md px-3 py-2 text-sm group"
          >
            <span className="text-secondary-foreground">{item.text}</span>
            <button
              onClick={() => deleteInboxItem(item.id)}
              className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {inbox.length === 0 && (
          <p className="text-muted-foreground text-xs text-center py-4">Inbox vazio — capture algo!</p>
        )}
      </div>
    </div>
  );
}
