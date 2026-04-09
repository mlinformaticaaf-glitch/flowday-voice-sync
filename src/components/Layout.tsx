import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Inbox, CheckSquare, Calendar, Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import MicButton from './MicButton';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inbox', icon: Inbox, label: 'Inbox' },
  { to: '/tarefas', icon: CheckSquare, label: 'Tarefas' },
  { to: '/agenda', icon: Calendar, label: 'Agenda' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const { user, profile, signOut } = useAuth();

  const displayName = profile?.display_name || user?.email?.split('@')[0] || '';
  const avatarUrl = profile?.avatar_url;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card p-4 justify-between">
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
            onClick={signOut}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-surface-hover w-full transition-colors"
          >
            <LogOut size={14} />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-card border-b border-border px-4 h-12">
        <h1 className="text-base font-bold text-primary">FlowDay</h1>
        <div className="flex items-center gap-2">
          {avatarUrl && <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full" />}
          <button onClick={() => setOpen(!open)} className="text-muted-foreground">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden fixed inset-0 z-30 bg-background/95 pt-12">
          <nav className="flex flex-col p-4 gap-1">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium ${
                  pathname === n.to ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                }`}
              >
                <n.icon size={18} />
                {n.label}
              </Link>
            ))}
            <button
              onClick={signOut}
              className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-muted-foreground mt-4 border-t border-border pt-4"
            >
              <LogOut size={18} />
              Sair
            </button>
          </nav>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 overflow-y-auto md:pt-0 pt-12">
        <div className="max-w-4xl mx-auto p-4 md:p-8">{children}</div>
      </main>

      <MicButton />
    </div>
  );
}
