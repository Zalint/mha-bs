import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ListChecks,
  TrendingUp,
} from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { KpiCard } from '../components/ui/KpiCard.js';
import { Spinner } from '../components/ui/Spinner.js';
import { StateBadge } from '../components/ui/StateBadge.js';
import { useApi } from '../hooks/useApi.js';
import { api } from '../lib/apiClient.js';
import { formatShort } from '../lib/formatDate.js';

interface DashboardResponse {
  kpis: {
    totalDirectives: number;
    nbRealisees: number;
    nbEnCours: number;
    nbAttente: number;
    nbIneligibles: number;
    nbRetards: number;
    tauxExecution: number;
  };
  statsByType: { typeRencontre: string; total: number; nbRealisees: number }[];
  evolution: { yearMonth: string; count: number }[];
  topRetards: {
    id: string;
    codeDirective: string;
    texteDirective: string;
    etat: 'enCours' | 'attente';
    echeance: string | null;
    daysLate: number;
  }[];
  byDirection: {
    directionId: number;
    directionCode: string;
    directionName: string;
    totalDirectives: number;
    nbRealisees: number;
    nbEnCours: number;
    nbRetards: number;
  }[];
}

const TYPE_LABELS: Record<string, string> = {
  conseilMinistres: 'Conseil des ministres',
  conseilInterMinisteriel: 'Conseil inter-ministériel',
  coordinationSggSg: 'Coordination SGG/SG',
};

export function DashboardView() {
  const navigate = useNavigate();
  const query = useApi(() => api.get<DashboardResponse>('/dashboard/global'), []);

  const evolutionLabels = useMemo(() => {
    if (!query.data) return [];
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    return query.data.evolution.map((p) => {
      const [year, month] = p.yearMonth.split('-');
      return `${months[Number(month) - 1] ?? month} ${year?.slice(2)}`;
    });
  }, [query.data]);

  const maxEvolution = useMemo(() => {
    if (!query.data) return 0;
    return Math.max(...query.data.evolution.map((p) => p.count), 1);
  }, [query.data]);

  if (query.isLoading) return <Spinner label="Chargement du dashboard…" />;
  if (query.error || !query.data) {
    return (
      <div className="bg-danger-bg border border-danger text-danger rounded-lg px-4 py-3 text-sm">
        Impossible de charger le dashboard.
      </div>
    );
  }

  const { kpis, statsByType, evolution, topRetards, byDirection } = query.data;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg leading-tight">Dashboard global</h1>
      <p className="text-sm text-fg-muted mb-5 mt-1">
        Vue temps réel du suivi des recommandations ministérielles
      </p>

      {/* KPIs */}
      <div className="grid gap-4 mb-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Taux d'exécution"
          value={`${kpis.tauxExecution} %`}
          delta={`${kpis.nbRealisees} sur ${kpis.totalDirectives}`}
          icon={TrendingUp}
          variant="success"
        />
        <KpiCard
          label="Directives suivies"
          value={kpis.totalDirectives}
          delta="depuis 2024"
          icon={ListChecks}
        />
        <KpiCard
          label="En cours / attente"
          value={kpis.nbEnCours + kpis.nbAttente}
          delta={`${kpis.nbEnCours} en cours · ${kpis.nbAttente} en attente`}
          icon={Clock}
          variant="warning"
        />
        <KpiCard
          label="En retard"
          value={kpis.nbRetards}
          delta="à relancer"
          icon={AlertTriangle}
          variant="danger"
        />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3 mb-5">
        {/* Evolution mensuelle */}
        <div className="card lg:col-span-2">
          <div className="card-header">
            <div>
              <h2 className="text-md font-semibold">Évolution mensuelle · directives reçues</h2>
              <p className="text-xs text-fg-muted mt-0.5">Sur les 12 derniers mois</p>
            </div>
          </div>
          <div className="card-body">
            {evolution.length === 0 ? (
              <p className="text-sm text-fg-muted text-center py-6">Pas encore de données.</p>
            ) : (
              <div className="flex items-end gap-2 h-48">
                {evolution.map((p, i) => (
                  <div key={p.yearMonth} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="text-[11px] font-mono text-fg-muted">{p.count}</div>
                    <div
                      className="w-full bg-primary rounded-t transition-all"
                      style={{ height: `${(p.count / maxEvolution) * 100}%` }}
                      title={`${evolutionLabels[i]} : ${p.count}`}
                    />
                    <div className="text-[10.5px] text-fg-muted whitespace-nowrap">
                      {evolutionLabels[i]}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Repartition par etat */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-md font-semibold">Répartition par état</h2>
          </div>
          <div className="card-body space-y-3">
            <DonutLegendRow color="#16A34A" label="Réalisée" value={kpis.nbRealisees} total={kpis.totalDirectives} />
            <DonutLegendRow color="#D97706" label="En cours" value={kpis.nbEnCours} total={kpis.totalDirectives} />
            <DonutLegendRow color="#0284C7" label="En attente" value={kpis.nbAttente} total={kpis.totalDirectives} />
            <DonutLegendRow color="#64748B" label="Inéligible" value={kpis.nbIneligibles} total={kpis.totalDirectives} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mb-5">
        {/* Top retards */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-md font-semibold">Top retards à traiter</h2>
          </div>
          <div className="card-body">
            {topRetards.length === 0 ? (
              <p className="text-sm text-fg-muted text-center py-4">Aucun retard détecté.</p>
            ) : (
              topRetards.map((r, i) => (
                <div
                  key={r.id}
                  onClick={() => navigate(`/directives/${r.id}`)}
                  className="grid grid-cols-[36px_1fr_auto] gap-3 items-start py-2.5 border-b border-border last:border-0 cursor-pointer hover:bg-muted px-2 rounded"
                >
                  <div className="font-mono text-xs text-fg-muted pt-0.5">#{i + 1}</div>
                  <div>
                    <div className="text-sm line-clamp-2 text-fg-2 leading-snug">
                      {r.texteDirective.slice(0, 140)}
                      {r.texteDirective.length > 140 ? '…' : ''}
                    </div>
                    <div className="text-[11.5px] text-fg-muted mt-1 flex items-center gap-2 flex-wrap">
                      <StateBadge etat={r.etat} />
                      <span className="font-mono">· Échéance {formatShort(r.echeance)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-danger font-mono font-semibold text-sm">+{r.daysLate} j</div>
                    <div className="text-[11px] text-fg-muted font-mono mt-0.5">{r.codeDirective}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Volume par type */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-md font-semibold">Volume par type de rencontre</h2>
          </div>
          <div className="card-body space-y-3">
            {statsByType.map((s) => {
              const maxTotal = Math.max(...statsByType.map((x) => x.total), 1);
              const pct = (s.total / maxTotal) * 100;
              return (
                <div key={s.typeRencontre} className="grid grid-cols-[1fr_2fr_50px] gap-3 items-center">
                  <div className="text-sm font-medium">{TYPE_LABELS[s.typeRencontre] ?? s.typeRencontre}</div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="font-mono text-sm font-semibold text-right">{s.total}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats par direction */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-md font-semibold">Top directions · taux d'exécution</h2>
        </div>
        <div className="card-body space-y-2">
          {byDirection.slice(0, 8).map((d) => {
            const pct = d.totalDirectives > 0 ? (d.nbRealisees / d.totalDirectives) * 100 : 0;
            return (
              <div key={d.directionId} className="grid grid-cols-[120px_1fr_60px] gap-3 items-center py-1.5">
                <div className="text-sm font-semibold">{d.directionCode}</div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <div className="font-mono text-sm text-right">
                  {d.nbRealisees}/{d.totalDirectives}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DonutLegendRow({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="flex-1">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
      <span className="text-fg-muted text-xs w-10 text-right">{pct}%</span>
    </div>
  );
}
