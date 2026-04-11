import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Inbox, CheckSquare, Calendar, Settings, LogOut, Menu, Flame, FolderKanban } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/useAppStore';
import MicButton from './MicButton';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inbox', icon: Inbox, label: 'Inbox' },
  { to: '/tarefas', icon: CheckSquare, label: 'Tarefas' },
  { to: '/agenda', icon: Calendar, label: 'Compromissos' },
  { to: '/habitos', icon: Flame, label: 'Hábitos' },
  { to: '/projetos', icon: FolderKanban, label: 'Projetos' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
];

const MOBILE_FIXED_NAV = [
  { to: '/tarefas', icon: CheckSquare, label: 'Tarefas' },
  { to: '/agenda', icon: Calendar, label: 'Compromissos' },
  { to: '/habitos', icon: Flame, label: 'Hábitos' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { session, user, profile, signOut } = useAuth();
  const initialize = useAppStore((state) => state.initialize);
  const saveGoogleSession = useAppStore((state) => state.saveGoogleSession);
  const clear = useAppStore((state) => state.clear);

  const displayName = profile?.display_name || user?.email?.split('@')[0] || '';
  const avatarUrl = profile?.avatar_url;

  useEffect(() => {
    let active = true;

    if (!session?.user.id) {
      clear();
      return () => {
        active = false;
      };
    }

    void (async () => {
      try {
        await saveGoogleSession(session);
        if (active) {
          await initialize(session.user.id);
        }
      } catch (error) {
        console.error('Failed to prepare application state', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [clear, initialize, saveGoogleSession, session]);

  const handleSignOut = async () => {
    clear();
    await signOut();
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-56 border-r border-border bg-card p-4 justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-primary mb-6 tracking-tight">FlowDay</h1>
          {NAV.map((n) => {
            const active = pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
                }`}
              >
                <n.icon size={18} />
                {n.label}
              </Link>
            );
          })}
        </div>

        {/* User section */}
        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex items-center gap-2 px-2">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-xs text-foreground truncate flex-1">{displayName}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-surface-hover w-full transition-colors"
          >
            <LogOut size={14} />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-card border-b border-border px-4 h-12">
        <h1 className="text-base font-bold text-primary">FlowDay</h1>
        <div className="flex items-center gap-3">
          {avatarUrl && <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full" />}
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 overflow-y-auto lg:pt-0 pt-12 pb-28 lg:pb-0">
        <div className="max-w-4xl mx-auto p-3 sm:p-4 lg:p-8">{children}</div>
      </main>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-border bg-card p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Todos os módulos</p>
                <p className="text-xs text-muted-foreground">Acesso rápido ao restante do aplicativo.</p>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-muted-foreground hover:text-foreground">
                <Menu size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {NAV.map((n) => {
                const active = pathname === n.to;
                return (
                  <Link
                    key={`drawer-${n.to}`}
                    to={n.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-sm font-medium ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground'}`}
                  >
                    <n.icon size={16} />
                    <span>{n.label}</span>
                  </Link>
                );
              })}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  void handleSignOut();
                }}
                className="col-span-2 flex items-center gap-3 rounded-lg border border-border px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <LogOut size={16} />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <ul className="grid grid-cols-4 px-1 py-1">
          <li>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex w-full flex-col items-center justify-center gap-0.5 rounded-md py-2 text-[10px] font-medium transition-colors min-h-14 text-muted-foreground"
            >
              <Menu size={17} />
              <span>Menu</span>
            </button>
          </li>
          {MOBILE_FIXED_NAV.map((n) => {
            const active = pathname === n.to;
            return (
              <li key={`mobile-${n.to}`}>
                <Link
                  to={n.to}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-md py-2 text-[10px] font-medium transition-colors min-h-14 ${
                    active ? 'text-primary bg-primary/10' : 'text-muted-foreground'
                  }`}
                >
                  <n.icon size={17} />
                  <span>{n.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <MicButton />
    </div>
  );
}
