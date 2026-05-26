import { Building2, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Spinner } from '../components/ui/Spinner.js';
import { useApi } from '../hooks/useApi.js';
import { api } from '../lib/apiClient.js';
import { cn } from '../lib/cn.js';

interface DirectionStats {
  directionId: number;
  directionCode: string;
  directionName: string;
  totalDirectives: number;
  nbRealisees: number;
  nbEnCours: number;
  nbAttente: number;
  nbIneligibles: number;
  nbRetards: number;
}

export function ParDirectionView() {
  const navigate = useNavigate();
  const query = useApi(
    () => api.get<{ items: DirectionStats[] }>('/dashboard/par-direction'),
    [],
  );

  const items = useMemo(
    () =>
      (query.data?.items ?? [])
        .slice()
        .sort((a, b) => b.totalDirectives - a.totalDirectives),
    [query.data],
  );

  const totals = useMemo(() => {
    const total = items.reduce((acc, d) => acc + d.totalDirectives, 0);
    const realisees = items.reduce((acc, d) => acc + d.nbRealisees, 0);
    const enCours = items.reduce((acc, d) => acc + d.nbEnCours, 0);
    const retards = items.reduce((acc, d) => acc + d.nbRetards, 0);
    return {
      total,
      realisees,
      enCours,
      retards,
      taux: total > 0 ? Math.round((realisees / total) * 1000) / 10 : 0,
    };
  }, [items]);

  if (query.isLoading) return <Spinner label="Chargement des stats par direction…" />;

  if (items.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center">
        <Building2 className="w-10 h-10 text-fg-muted mx-auto mb-3" strokeWidth={1.5} />
        <h2 className="text-base font-semibold mb-1">Aucune direction n&apos;a encore de directives</h2>
        <p className="text-sm text-fg-muted">
          Les directives doivent être assignées à une direction responsable pour apparaître ici.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-fg leading-tight flex items-center gap-2.5">
          <Building2 className="w-6 h-6 text-primary" strokeWidth={1.8} />
          Répartition par direction
        </h1>
        <p className="text-sm text-fg-muted mt-1">
          Charge de directives par direction technique du MHA · {items.length} direction
          {items.length > 1 ? 's' : ''} active{items.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* KPIs globaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="text-[10.5px] uppercase tracking-wider text-fg-muted font-medium">
            Total directives
          </div>
          <div className="font-mono text-3xl font-bold mt-1 tabular-nums">{totals.total}</div>
          <div className="text-[11.5px] text-fg-muted mt-1">
            réparties sur {items.length} direction{items.length > 1 ? 's' : ''}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="text-[10.5px] uppercase tracking-wider text-fg-muted font-medium">
            Taux global
          </div>
          <div className="font-mono text-3xl font-bold mt-1 tabular-nums text-success">
            {totals.taux} %
          </div>
          <div className="text-[11.5px] text-fg-muted mt-1">
            {totals.realisees} / {totals.total}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="text-[10.5px] uppercase tracking-wider text-fg-muted font-medium">
            En cours
          </div>
          <div className="font-mono text-3xl font-bold mt-1 tabular-nums text-warning">
            {totals.enCours}
          </div>
          <div className="text-[11.5px] text-fg-muted mt-1">en exécution</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="text-[10.5px] uppercase tracking-wider text-fg-muted font-medium">
            En retard
          </div>
          <div
            className={cn(
              'font-mono text-3xl font-bold mt-1 tabular-nums',
              totals.retards > 0 ? 'text-danger' : 'text-fg',
            )}
          >
            {totals.retards}
          </div>
          <div className="text-[11.5px] text-fg-muted mt-1">échéances dépassées</div>
        </div>
      </div>

      {/* Tableau directions */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface2 flex items-center justify-between">
          <h2 className="text-md font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Charge et exécution par direction
          </h2>
          <span className="text-xs text-fg-muted font-mono">Triées par volume</span>
        </div>
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="bg-surface2">
            <tr>
              <th className="text-left px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-20">
                Code
              </th>
              <th className="text-left px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border">
                Direction
              </th>
              <th className="text-center px-3 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-16">
                Total
              </th>
              <th className="text-center px-3 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-16">
                ✓
              </th>
              <th className="text-center px-3 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-16">
                Cours
              </th>
              <th className="text-center px-3 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-16">
                Attente
              </th>
              <th className="text-center px-3 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-16">
                Retard
              </th>
              <th className="text-left px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-[260px]">
                Taux d&apos;exécution
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => {
              const taux =
                d.totalDirectives > 0
                  ? Math.round((d.nbRealisees / d.totalDirectives) * 1000) / 10
                  : 0;
              return (
                <tr key={d.directionId} className="border-b border-border last:border-0 hover:bg-muted">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{d.directionCode}</td>
                  <td className="px-4 py-3 text-sm">{d.directionName}</td>
                  <td className="px-3 py-3 text-center font-mono font-semibold">{d.totalDirectives}</td>
                  <td className="px-3 py-3 text-center font-mono text-success">{d.nbRealisees}</td>
                  <td className="px-3 py-3 text-center font-mono text-warning">{d.nbEnCours}</td>
                  <td className="px-3 py-3 text-center font-mono text-primary">{d.nbAttente}</td>
                  <td className={cn(
                    'px-3 py-3 text-center font-mono',
                    d.nbRetards > 0 ? 'text-danger font-semibold' : 'text-fg-muted',
                  )}>
                    {d.nbRetards}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            taux >= 80 ? 'bg-success' : taux >= 50 ? 'bg-warning' : 'bg-primary',
                          )}
                          style={{ width: `${Math.min(taux, 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-semibold min-w-[44px] text-right tabular-nums">
                        {taux}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-fg-muted italic mt-4">
        Les directions sont définies dans <button
          type="button"
          onClick={() => navigate('/bs/config')}
          className="text-primary hover:underline"
        >Configuration</button>. Les directives sans direction assignée ne sont pas comptées ici.
      </p>
    </div>
  );
}
