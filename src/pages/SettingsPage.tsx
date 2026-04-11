import GoogleSyncCard from '@/components/GoogleSyncCard';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/stores/useAppStore';
import { signInWithGoogleProductivity } from '@/lib/googleOAuth';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const googleConnection = useAppStore((state) => state.googleConnection);

  const email = user?.email ?? 'Sem e-mail';
  const displayName = profile?.display_name || user?.user_metadata?.full_name || email.split('@')[0] || 'Usuário';
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || null;
  const provider = user?.app_metadata?.provider?.toString() ?? 'google';

  const handleLinkGoogle = async () => {
    const result = await signInWithGoogleProductivity();
    if (result.error) {
      toast.error('Não foi possível vincular a conta Google.');
      return;
    }

    if (result.redirected) {
      return;
    }

    toast.success('Conta Google vinculada com sucesso.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie conexões e preferências da sua conta.
        </p>
      </div>

      <Tabs defaultValue="conta" className="space-y-4">
        <TabsList>
          <TabsTrigger value="conta">Conta</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
        </TabsList>

        <TabsContent value="conta" className="space-y-4">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Perfil</h2>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar do usuário" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-foreground">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{email}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Provedor</p>
                  <p className="text-sm text-foreground mt-0.5">{provider}</p>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">ID da conta</p>
                  <p className="text-sm text-foreground mt-0.5 truncate">{user?.id ?? 'Não disponível'}</p>
                </div>
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="integracoes" className="space-y-4">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Integrações</h2>
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Vincular conta Google</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vincule sua conta Google para habilitar sincronização com Calendar e Tasks.
                </p>
              </div>
              <button
                onClick={() => void handleLinkGoogle()}
                disabled={googleConnection.connected && !googleConnection.needsReconnect}
                className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
              >
                {googleConnection.connected && !googleConnection.needsReconnect ? 'Conta Google já vinculada' : 'Vincular conta Google'}
              </button>
            </div>
            <GoogleSyncCard />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}