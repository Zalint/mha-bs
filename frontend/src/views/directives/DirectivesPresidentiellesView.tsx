import { Landmark } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

import { useApi } from '../../hooks/useApi.js';
import { api } from '../../lib/apiClient.js';
import { cn } from '../../lib/cn.js';

interface NavCounts {
  directives: {
    conseilInterMinisteriel: number;
    conseilMinistres: number;
    coordinationSggSg: number;
  };
}

const TABS = [
  { to: '/directives/conseil-interministeriel', label: 'Conseil inter-ministériel', key: 'conseilInterMinisteriel' as const },
  { to: '/directives/conseil-ministres', label: 'Conseil des ministres', key: 'conseilMinistres' as const },
  { to: '/directives/coordination-sg', label: 'Coordination SGG/SG', key: 'coordinationSggSg' as const },
];

export function DirectivesPresidentiellesView() {
  const counts = useApi(() => api.get<NavCounts>('/dashboard/nav-counts'), []);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-fg leading-tight flex items-center gap-2.5">
          <Landmark className="w-6 h-6 text-primary" strokeWidth={1.8} />
          Directives présidentielles
        </h1>
        <p className="text-sm text-fg-muted mt-1">
          Suivi des directives issues des Conseils et instances de la Présidence
        </p>
      </div>

      <div className="border-b border-border mb-4">
        <nav className="flex flex-wrap gap-1" aria-label="Onglets Directives présidentielles">
          {TABS.map((t) => {
            const badge = counts.data?.directives[t.key];
            return (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-fg-muted hover:text-fg hover:border-border',
                  )
                }
              >
                {t.label}
                {badge !== undefined && badge !== 0 && (
                  <span className="bg-fg-muted/15 text-fg-muted text-[11px] px-1.5 py-0.5 rounded-full font-mono">
                    {badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}
