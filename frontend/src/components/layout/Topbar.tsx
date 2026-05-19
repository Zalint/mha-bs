import { Bell, KeyRound, LogOut, Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../stores/authStore.js';
import { ChangeMyPasswordModal } from './ChangeMyPasswordModal.js';

interface TopbarProps {
  crumbs?: string[];
}

export function Topbar({ crumbs = [] }: TopbarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [pwdOpen, setPwdOpen] = useState(false);

  const handleLogout = (): void => {
    logout();
    navigate('/login');
  };

  const initials =
    user?.fullName
      ?.split(' ')
      .map((s) => s[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() ?? '??';

  return (
    <header className="h-[60px] bg-surface border-b border-border flex items-center px-6 gap-4 sticky top-0 z-10">
      <div className="text-sm text-fg-muted">
        {crumbs.map((c, i) => (
          <span key={`${c}-${i}`}>
            {i > 0 && <span className="mx-1.5 text-fg-muted">/</span>}
            <span className={i === crumbs.length - 1 ? 'text-fg font-semibold' : ''}>{c}</span>
          </span>
        ))}
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2 bg-muted border border-border px-3 py-1.5 rounded-full min-w-[280px]">
        <Search className="w-3.5 h-3.5 text-fg-muted" />
        <input
          type="text"
          aria-label="Recherche globale"
          placeholder="Rechercher une recommandation, une rencontre…"
          className="bg-transparent border-0 outline-0 flex-1 text-sm text-fg placeholder:text-fg-muted"
        />
        <kbd className="text-xs text-fg-muted font-mono">Ctrl K</kbd>
      </div>
      <button
        type="button"
        aria-label="Notifications"
        className="w-9 h-9 flex items-center justify-center border border-border bg-surface rounded text-fg-2 hover:bg-muted"
      >
        <Bell className="w-[18px] h-[18px]" strokeWidth={1.8} />
      </button>
      <div className="flex items-center gap-2.5 bg-muted rounded-full pl-1 pr-3 py-1">
        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-semibold text-xs">
          {initials}
        </div>
        <div className="text-sm">
          <div className="font-semibold">{user?.fullName ?? '—'}</div>
          <div className="text-fg-muted text-[11.5px]">{user?.role.toUpperCase()}</div>
        </div>
        <button
          type="button"
          onClick={() => setPwdOpen(true)}
          aria-label="Changer mon mot de passe"
          className="ml-1 text-fg-muted hover:text-primary transition-colors"
          title="Changer mon mot de passe"
        >
          <KeyRound className="w-4 h-4" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Deconnexion"
          className="ml-1 text-fg-muted hover:text-danger transition-colors"
          title="Déconnexion"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.8} />
        </button>
      </div>
      <ChangeMyPasswordModal open={pwdOpen} onOpenChange={setPwdOpen} />
    </header>
  );
}
