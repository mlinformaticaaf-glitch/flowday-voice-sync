import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Inbox, CheckSquare, Calendar, Menu, X } from 'lucide-react';
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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card p-4 gap-1">
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
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-card border-b border-border px-4 h-12">
        <h1 className="text-base font-bold text-primary">FlowDay</h1>
        <button onClick={() => setOpen(!open)} className="text-muted-foreground">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
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
