import { RefreshCw, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/useAppStore';
import { signInWithGoogleProductivity } from '@/lib/googleOAuth';

function formatSyncDate(value: string | null): string {
  if (!value) return 'Nunca';
  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function GoogleSyncCard() {
  const googleConnection = useAppStore((state) => state.googleConnection);
  const syncingGoogle = useAppStore((state) => state.syncingGoogle);
  const syncGoogle = useAppStore((state) => state.syncGoogle);
  const disconnectGoogle = useAppStore((state) => state.disconnectGoogle);

  const handleConnect = async () => {
    const result = await signInWithGoogleProductivity();
    if (result.error) {
      toast.error('Não foi possível conectar ao Google.');
    }
  };

  const handleSync = async () => {
    try {
      const result = await syncGoogle();
      toast.success(`Sincronização concluída: ${result.tasks} tarefas e ${result.appointments} compromissos.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao sincronizar com o Google.');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectGoogle();
      toast.success('Integração Google desconectada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao desconectar Google.');
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Google Calendar + Tasks</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {googleConnection.connected
              ? `Conectado${googleConnection.email ? ` como ${googleConnection.email}` : ''}`
              : 'Ainda não conectado'}
          </p>
        </div>
        <div className={`text-[11px] px-2 py-1 rounded-full ${googleConnection.connected ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
          {googleConnection.needsReconnect ? 'Reconectar' : googleConnection.connected ? 'Ativo' : 'Pendente'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
        <div>
          <p>Agenda</p>
          <p className="text-foreground mt-1">{formatSyncDate(googleConnection.lastCalendarSyncAt)}</p>
        </div>
        <div>
          <p>Tarefas</p>
          <p className="text-foreground mt-1">{formatSyncDate(googleConnection.lastTasksSyncAt)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={googleConnection.connected && !googleConnection.needsReconnect ? handleSync : handleConnect}
          disabled={syncingGoogle}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          <RefreshCw size={14} className={syncingGoogle ? 'animate-spin' : ''} />
          {googleConnection.connected && !googleConnection.needsReconnect ? 'Sincronizar agora' : 'Conectar Google'}
        </button>

        {(googleConnection.connected || googleConnection.needsReconnect) && (
          <button
            onClick={handleDisconnect}
            className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary/80"
          >
            <Unplug size={14} />
            Desconectar
          </button>
        )}
      </div>
    </div>
  );
}