import { ClipboardList } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

import { useApi } from '../../hooks/useApi.js';
import { useReferentiel } from '../../hooks/useReferentiel.js';
import { api } from '../../lib/apiClient.js';
import { cn } from '../../lib/cn.js';

interface NavCounts {
  recommandations: Record<string, number>;
}

export function RecommandationsMhaView() {
  const counts = useApi(() => api.get<NavCounts>('/dashboard/nav-counts'), []);
  const categories = useReferentiel('matriceCategorie');

  // Onglets dynamiques : pilotés par le référentiel matriceCategorie. Le code de la
  // catégorie devient le segment d'URL (/recommandations/:code) — on garde
  // copil/reformes/cngi historiques mais on accueille aussi les nouvelles
  // catégories (Autres, ou toute autre créée via Configuration).
  const tabs = categories.items.map((c) => ({
    to: `/recommandations/${c.code}`,
    label: c.label,
    code: c.code,
    badge: counts.data?.recommandations?.[c.code] ?? 0,
  }));

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-fg leading-tight flex items-center gap-2.5">
          <ClipboardList className="w-6 h-6 text-primary" strokeWidth={1.8} />
          Recommandations MHA
        </h1>
        <p className="text-sm text-fg-muted mt-1">
          Suivi des recommandations issues des instances de pilotage internes du Ministère
        </p>
      </div>

      <div className="border-b border-border mb-4">
        <nav className="flex flex-wrap gap-1" aria-label="Onglets Recommandations MHA">
          {tabs.map((t) => (
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
              {t.badge > 0 && (
                <span className="bg-fg-muted/15 text-fg-muted text-[11px] px-1.5 py-0.5 rounded-full font-mono">
                  {t.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}
