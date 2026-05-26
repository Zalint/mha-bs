import { CheckCircle2, ClipboardList, Clock, FileText, Mic, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Spinner } from '../components/ui/Spinner.js';
import { useApi } from '../hooks/useApi.js';
import { useReferentiel } from '../hooks/useReferentiel.js';
import { api } from '../lib/apiClient.js';
import { cn } from '../lib/cn.js';
import { formatShort } from '../lib/formatDate.js';

interface Interpellation {
  id: string;
  reference: string;
  deputeId: string;
  deputeNom: string | null;
  deputeGroupe: string | null;
  sessionId: string | null;
  sessionIntitule: string | null;
  titre: string;
  description: string | null;
  typeInterpellation: string;
  dateReception: string;
  echeanceReponse: string | null;
  dateReponse: string | null;
  etat: string;
  texteReponse: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InterpellationStats {
  total: number;
  parEtat: Record<string, number>;
  parType: Record<string, number>;
  parGroupe: Record<string, number>;
}

const ETAT_STYLES: Record<string, string> = {
  recue: 'bg-info-bg text-info',
  enPreparation: 'bg-warning-bg text-warning',
  aValider: 'bg-primary-100 text-primary-700',
  repondue: 'bg-success-bg text-success',
};

export function InterpellationsView() {
  const navigate = useNavigate();
  const listQuery = useApi(() => api.get<{ items: Interpellation[] }>('/interpellations'), []);
  const statsQuery = useApi(() => api.get<InterpellationStats>('/interpellations/stats'), []);
  const etatRef = useReferentiel('etatInterpellation');
  const typeRef = useReferentiel('typeInterpellation');

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);
  const stats = statsQuery.data;

  const etatLabel = (code: string): string =>
    etatRef.items.find((r) => r.code === code)?.label ?? code;
  const typeLabel = (code: string): string =>
    typeRef.items.find((r) => r.code === code)?.label ?? code;

  if (listQuery.isLoading || statsQuery.isLoading) {
    return <Spinner label="Chargement des interpellations…" />;
  }

  const isOverdue = (i: Interpellation): boolean => {
    if (!i.echeanceReponse || i.etat === 'repondue') return false;
    return new Date(i.echeanceReponse) < new Date();
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-fg leading-tight flex items-center gap-2.5">
          <Mic className="w-6 h-6 text-primary" strokeWidth={1.8} />
          Interpellations parlementaires
        </h1>
        <p className="text-sm text-fg-muted mt-1">
          Questions orales, écrites et interpellations en commission posées par les députés au MHA
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiBlock
          icon={ClipboardList}
          label="Total interpellations"
          value={stats?.total ?? 0}
          delta="depuis l'origine"
        />
        <KpiBlock
          icon={CheckCircle2}
          label="Répondues"
          value={stats?.parEtat.repondue ?? 0}
          delta={stats && stats.total > 0
            ? `${Math.round(((stats.parEtat.repondue ?? 0) / stats.total) * 100)} % du total`
            : '—'}
          variant="success"
        />
        <KpiBlock
          icon={Clock}
          label="En préparation"
          value={(stats?.parEtat.enPreparation ?? 0) + (stats?.parEtat.aValider ?? 0)}
          delta={`${stats?.parEtat.enPreparation ?? 0} prep · ${stats?.parEtat.aValider ?? 0} à valider`}
          variant="warning"
        />
        <KpiBlock
          icon={FileText}
          label="Reçues"
          value={stats?.parEtat.recue ?? 0}
          delta="non démarrées"
          variant="info"
        />
      </div>

      {/* Répartitions */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 mb-5">
        <div className="bg-surface rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-primary" />
            Par type
          </h3>
          {stats && Object.keys(stats.parType).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(stats.parType).map(([type, count]) => (
                <BarRow key={type} label={typeLabel(type)} value={count} max={stats.total} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-fg-muted text-center py-6">Pas de données</p>
          )}
        </div>
        <div className="bg-surface rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-primary" />
            Par groupe parlementaire
          </h3>
          {stats && Object.keys(stats.parGroupe).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(stats.parGroupe)
                .sort(([, a], [, b]) => b - a)
                .map(([groupe, count]) => (
                  <BarRow key={groupe} label={groupe} value={count} max={stats.total} />
                ))}
            </div>
          ) : (
            <p className="text-sm text-fg-muted text-center py-6">Pas de données</p>
          )}
        </div>
      </div>

      {/* Liste */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface2 flex items-center justify-between">
          <h2 className="text-md font-semibold">Liste des interpellations</h2>
          <span className="text-xs text-fg-muted font-mono">
            {items.length} interpellation{items.length > 1 ? 's' : ''}
          </span>
        </div>
        {items.length === 0 ? (
          <div className="text-center text-fg-muted py-12 text-sm">
            Aucune interpellation enregistrée pour le moment.
          </div>
        ) : (
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="bg-surface2">
              <tr>
                <th className="text-left px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-28">
                  Réf.
                </th>
                <th className="text-left px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-24">
                  Date
                </th>
                <th className="text-left px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-20">
                  Type
                </th>
                <th className="text-left px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border">
                  Titre & député
                </th>
                <th className="text-left px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-24">
                  Échéance
                </th>
                <th className="text-center px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-32">
                  État
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b border-border last:border-0 hover:bg-muted">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{i.reference}</td>
                  <td className="px-4 py-3 font-mono text-xs text-fg-muted">
                    {formatShort(i.dateReception)}
                  </td>
                  <td className="px-4 py-3 text-xs">{typeLabel(i.typeInterpellation)}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium line-clamp-2">{i.titre}</div>
                    <div className="text-[11.5px] text-fg-muted mt-0.5">
                      {i.deputeNom ?? '— député —'}
                      {i.deputeGroupe ? ` · ${i.deputeGroupe}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {i.echeanceReponse ? (
                      <span className={cn(isOverdue(i) && 'text-danger font-semibold')}>
                        {formatShort(i.echeanceReponse)}
                      </span>
                    ) : (
                      <span className="text-fg-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold',
                        ETAT_STYLES[i.etat] ?? 'bg-muted text-fg-2',
                      )}
                    >
                      {etatLabel(i.etat)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-fg-muted italic mt-4">
        La saisie d&apos;une interpellation se fait via le module BS (à venir). Les états sont
        configurables dans <button
          type="button"
          onClick={() => navigate('/bs/config')}
          className="text-primary hover:underline"
        >Configuration</button>.
      </p>
    </div>
  );
}

interface KpiBlockProps {
  icon: typeof Mic;
  label: string;
  value: number;
  delta: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const KPI_STYLES = {
  default: 'text-fg',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-primary',
} as const;

function KpiBlock({ icon: Icon, label, value, delta, variant = 'default' }: KpiBlockProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 relative">
      <Icon className="w-4 h-4 text-fg-muted absolute top-4 right-4" />
      <div className="text-[10.5px] uppercase tracking-wider text-fg-muted font-medium">{label}</div>
      <div className={cn('font-mono text-3xl font-bold mt-1 tabular-nums', KPI_STYLES[variant])}>
        {value}
      </div>
      <div className="text-[11.5px] text-fg-muted mt-1">{delta}</div>
    </div>
  );
}

interface BarRowProps {
  label: string;
  value: number;
  max: number;
}

function BarRow({ label, value, max }: BarRowProps) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="grid grid-cols-[130px_1fr_40px] gap-3 items-center text-sm">
      <span className="truncate text-fg-2">{label}</span>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.max(pct, 3)}%` }} />
      </div>
      <span className="font-mono text-sm font-semibold text-right tabular-nums">{value}</span>
    </div>
  );
}
