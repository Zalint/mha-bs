/**
 * Module Visualisations — slice & dice sur les directives et recommandations.
 *
 * 8 charts Directives (filtrables : année, mode, type de rencontre)
 * + 2 charts Recommandations matrice (pas de filtre annee — la table n'en a pas).
 *
 * Bibliothèque : Recharts (bundlée, React natif).
 */

import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
  ChevronRight,
  Clock,
  Filter,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { type AnneeMode, TYPES_RENCONTRE } from '@mha-bs/shared';

import { AnneeFilterHelp } from '../components/directives/AnneeFilterHelp.js';
import { Spinner } from '../components/ui/Spinner.js';
import { useApi } from '../hooks/useApi.js';
import { api } from '../lib/apiClient.js';
import { cn } from '../lib/cn.js';

// ===== Types réponses backend =====
interface DirectivesPayload {
  filters: { annee?: number; anneeMode: AnneeMode; typeRencontre?: string };
  etatParAnnee: { annee: number; attente: number; enCours: number; realisee: number; ineligible: number }[];
  nouvellesParMois: { mois: string; nb: number }[];
  parType: { typeRencontre: string; nb: number }[];
  heatmapEcheance: { mois: number; etat: string; nb: number }[];
  topMinisteres: { ministere: string; nb: number }[];
  delaiParType: {
    typeRencontre: string;
    joursPrevuMoy: number;
    joursReelMoy: number;
    nbAvecDonnees: number;
  }[];
  funnel: { etat: string; nb: number }[];
  backlogParTrimestre: { trimestre: string; enAttente: number; enCours: number; total: number }[];
}

interface RecommandationsPayload {
  parCategorie: {
    categorie: string;
    attente: number;
    enCours: number;
    realisee: number;
    ineligible: number;
  }[];
  tauxParProjet: { projet: string; total: number; realisees: number; taux: number }[];
}

// ===== Palettes =====
const ETAT_COLORS = {
  attente: '#FBBF24',
  enCours: '#FB7185',
  realisee: '#10B981',
  ineligible: '#94A3B8',
} as const;

const ETAT_LABELS: Record<string, string> = {
  attente: 'En attente',
  enCours: 'En cours',
  realisee: 'Réalisée',
  ineligible: 'Inéligible',
};

const TYPE_RENCONTRE_LABELS: Record<string, string> = {
  conseilMinistres: 'CM',
  conseilInterMinisteriel: 'CIM',
  coordinationSggSg: 'Coord SG',
};

const PIE_COLORS = ['#0284C7', '#F97316', '#A855F7', '#10B981', '#EC4899', '#F59E0B'];

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

// ===== View principale =====

export function VisualisationsView() {
  const [activeTab, setActiveTab] = useState<'directives' | 'recommandations'>('directives');
  const [annee, setAnnee] = useState<number | ''>(new Date().getFullYear());
  const [anneeMode, setAnneeMode] = useState<AnneeMode>('active');
  const [typeRencontre, setTypeRencontre] = useState<string>('');

  const directivesQuery = useApi(
    () =>
      api.get<DirectivesPayload>('/visualisations/directives', {
        query: {
          ...(annee !== '' ? { annee: String(annee), anneeMode } : {}),
          ...(typeRencontre ? { typeRencontre } : {}),
        },
      }),
    [annee, anneeMode, typeRencontre],
  );

  const recommandationsQuery = useApi(
    () => api.get<RecommandationsPayload>('/visualisations/recommandations'),
    [],
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-fg leading-tight flex items-center gap-2.5">
          <BarChart3 className="w-6 h-6 text-primary" strokeWidth={1.8} />
          Visualisations
        </h1>
        <p className="text-sm text-fg-muted mt-1">
          Explorer les directives présidentielles et les recommandations matrice
          sous différents angles. 8 charts pour les directives, 2 pour les recommandations.
        </p>
      </div>

      {/* Onglets */}
      <div className="border-b border-border mb-5">
        <div className="flex gap-1">
          <TabButton
            active={activeTab === 'directives'}
            onClick={() => setActiveTab('directives')}
            icon={Activity}
          >
            Directives présidentielles
          </TabButton>
          <TabButton
            active={activeTab === 'recommandations'}
            onClick={() => setActiveTab('recommandations')}
            icon={Target}
          >
            Recommandations matrice
          </TabButton>
        </div>
      </div>

      {/* Onglet Directives */}
      {activeTab === 'directives' && (
        <>
          {/* Barre de filtres globaux */}
          <div className="bg-surface border border-border rounded-xl p-4 mb-5 flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-1.5 text-xs text-fg-muted">
              <Filter className="w-3.5 h-3.5" /> Filtres globaux ·
            </div>
            <FilterGroup label="Type de rencontre">
              <select
                value={typeRencontre}
                onChange={(e) => setTypeRencontre(e.target.value)}
                className="input input-sm text-xs"
              >
                <option value="">Tous types</option>
                {TYPES_RENCONTRE.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_RENCONTRE_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            </FilterGroup>
            <FilterGroup
              label={
                <>
                  Année <AnneeFilterHelp currentMode={anneeMode} />
                </>
              }
            >
              <div className="flex gap-1">
                <select
                  value={String(annee)}
                  onChange={(e) =>
                    setAnnee(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="input input-sm text-xs"
                >
                  <option value="">Toutes</option>
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                {annee !== '' && (
                  <select
                    value={anneeMode}
                    onChange={(e) => setAnneeMode(e.target.value as AnneeMode)}
                    className="input input-sm text-xs"
                    title="Sémantique du filtre Année"
                  >
                    <option value="active">Active</option>
                    <option value="creation">Création</option>
                    <option value="echeance">Échéance</option>
                  </select>
                )}
              </div>
            </FilterGroup>
            {(annee !== '' || typeRencontre) && (
              <button
                type="button"
                onClick={() => {
                  setAnnee('');
                  setTypeRencontre('');
                }}
                className="text-xs text-fg-muted hover:text-fg underline ml-auto"
              >
                Réinitialiser
              </button>
            )}
          </div>

          {directivesQuery.isLoading ? (
            <Spinner label="Chargement des visualisations…" />
          ) : directivesQuery.error || !directivesQuery.data ? (
            <div className="bg-danger-bg border border-danger text-danger rounded p-4 text-sm">
              Erreur de chargement des données.
            </div>
          ) : (
            <DirectivesCharts data={directivesQuery.data} />
          )}
        </>
      )}

      {/* Onglet Recommandations */}
      {activeTab === 'recommandations' && (
        <>
          {recommandationsQuery.isLoading ? (
            <Spinner label="Chargement des recommandations…" />
          ) : recommandationsQuery.error || !recommandationsQuery.data ? (
            <div className="bg-danger-bg border border-danger text-danger rounded p-4 text-sm">
              Erreur de chargement des données.
            </div>
          ) : (
            <RecommandationsCharts data={recommandationsQuery.data} />
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// Onglet Directives : 8 charts
// =============================================================================

function DirectivesCharts({ data }: { data: DirectivesPayload }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Chart 1 : État × année (stacked bar) */}
      <ChartCard
        title="Évolution par état et année"
        subtitle="Répartition des directives par état au fil des années"
        icon={BarChart3}
      >
        {data.etatParAnnee.length === 0 ? (
          <EmptyPlaceholder />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.etatParAnnee}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="annee" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend
                formatter={(value: string) => ETAT_LABELS[value] ?? value}
                wrapperStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="attente" stackId="a" fill={ETAT_COLORS.attente} />
              <Bar dataKey="enCours" stackId="a" fill={ETAT_COLORS.enCours} />
              <Bar dataKey="realisee" stackId="a" fill={ETAT_COLORS.realisee} />
              <Bar dataKey="ineligible" stackId="a" fill={ETAT_COLORS.ineligible} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Chart 2 : Nouvelles directives par mois (line) */}
      <ChartCard
        title="Nouvelles directives par mois"
        subtitle="Évolution mensuelle du volume entrant"
        icon={LineChartIcon}
      >
        {data.nouvellesParMois.length === 0 ? (
          <EmptyPlaceholder />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.nouvellesParMois}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="nb" stroke="#0284C7" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Chart 3 : Répartition par type de rencontre (donut) */}
      <ChartCard
        title="Répartition par type de rencontre"
        subtitle="CM / CIM / Coordination SG"
        icon={PieChartIcon}
      >
        {data.parType.length === 0 ? (
          <EmptyPlaceholder />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data.parType}
                dataKey="nb"
                nameKey="typeRencontre"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                label={(props: { name?: string; value?: number }) => {
                  const label = TYPE_RENCONTRE_LABELS[String(props.name)] ?? String(props.name);
                  return `${label}: ${props.value ?? ''}`;
                }}
                labelLine={false}
              >
                {data.parType.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  value,
                  TYPE_RENCONTRE_LABELS[String(name)] ?? String(name),
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Chart 4 : Heatmap mois × état */}
      <ChartCard
        title="Échéances par mois et état"
        subtitle="Quand a-t-on des retards ? (échéances seulement)"
        icon={Calendar}
      >
        <HeatmapEcheance cells={data.heatmapEcheance} />
      </ChartCard>

      {/* Chart 5 : Top 10 ministères */}
      <ChartCard
        title="Top 10 ministères associés"
        subtitle="Qui porte le plus de directives ?"
        icon={Building2}
      >
        {data.topMinisteres.length === 0 ? (
          <EmptyPlaceholder />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, data.topMinisteres.length * 28)}>
            <BarChart data={data.topMinisteres} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                dataKey="ministere"
                type="category"
                tick={{ fontSize: 11 }}
                width={120}
              />
              <Tooltip />
              <Bar dataKey="nb" fill="#0284C7" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Chart 6 : Délai prévu vs réel */}
      <ChartCard
        title="Délais prévus vs réels"
        subtitle="Moyenne en jours par type de rencontre"
        icon={Clock}
      >
        {data.delaiParType.length === 0 ? (
          <EmptyPlaceholder />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.delaiParType}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="typeRencontre"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => TYPE_RENCONTRE_LABELS[v] ?? v}
              />
              <YAxis tick={{ fontSize: 11 }} label={{ value: 'jours', angle: -90, fontSize: 11, position: 'insideLeft' }} />
              <Tooltip
                labelFormatter={(label) => TYPE_RENCONTRE_LABELS[String(label)] ?? String(label)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="joursPrevuMoy" name="Prévu" fill="#94A3B8" />
              <Bar dataKey="joursReelMoy" name="Réel" fill="#0284C7" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Chart 7 : Funnel attente → en cours → réalisée */}
      <ChartCard
        title="Funnel d'exécution"
        subtitle="Conversion attente → en cours → réalisée"
        icon={ChevronRight}
      >
        <Funnel etapes={data.funnel} />
      </ChartCard>

      {/* Chart 8 : Backlog trimestriel */}
      <ChartCard
        title="Backlog par trimestre"
        subtitle="Stock de directives non-closes (attente + en cours) émises avant chaque trimestre"
        icon={TrendingUp}
      >
        {data.backlogParTrimestre.length === 0 ? (
          <EmptyPlaceholder />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.backlogParTrimestre}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="trimestre" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend
                formatter={(value: string) => ETAT_LABELS[value] ?? value}
                wrapperStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="enAttente" stackId="b" fill={ETAT_COLORS.attente} />
              <Bar dataKey="enCours" stackId="b" fill={ETAT_COLORS.enCours} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

// =============================================================================
// Onglet Recommandations : 2 charts
// =============================================================================

function RecommandationsCharts({ data }: { data: RecommandationsPayload }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Chart 9 : Recommandations par catégorie matrice × état */}
      <ChartCard
        title="Recommandations par catégorie"
        subtitle="COPIL / Réformes / CNGI · répartition par état"
        icon={BarChart3}
      >
        {data.parCategorie.length === 0 ? (
          <EmptyPlaceholder />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.parCategorie}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="categorie" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend
                formatter={(value: string) => ETAT_LABELS[value] ?? value}
                wrapperStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="attente" stackId="c" fill={ETAT_COLORS.attente} />
              <Bar dataKey="enCours" stackId="c" fill={ETAT_COLORS.enCours} />
              <Bar dataKey="realisee" stackId="c" fill={ETAT_COLORS.realisee} />
              <Bar dataKey="ineligible" stackId="c" fill={ETAT_COLORS.ineligible} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Chart 10 : Taux d'exécution par projet COPIL */}
      <ChartCard
        title="Taux d'exécution par projet COPIL"
        subtitle="% de recommandations réalisées par projet (PROGEP, PISEA, PDBH…)"
        icon={Target}
      >
        {data.tauxParProjet.length === 0 ? (
          <EmptyPlaceholder />
        ) : (
          <div className="space-y-3 px-1">
            {data.tauxParProjet.map((p) => (
              <div key={p.projet}>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-semibold">{p.projet}</span>
                  <span className="text-fg-muted">
                    <span className="font-mono">{p.realisees}</span> /{' '}
                    <span className="font-mono">{p.total}</span> ·{' '}
                    <span
                      className={cn(
                        'font-bold',
                        p.taux >= 60
                          ? 'text-success'
                          : p.taux >= 30
                            ? 'text-warning'
                            : 'text-danger',
                      )}
                    >
                      {p.taux.toFixed(1)} %
                    </span>
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      p.taux >= 60 ? 'bg-success' : p.taux >= 30 ? 'bg-warning' : 'bg-danger',
                    )}
                    style={{ width: `${Math.min(p.taux, 100)}%` }}
                  />
                  {/* Cible à 60% */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-fg-muted opacity-50"
                    style={{ left: '60%' }}
                    title="Cible 60%"
                  />
                </div>
              </div>
            ))}
            <p className="text-[10.5px] text-fg-muted italic mt-2">
              Trait vertical = cible à 60 %.
            </p>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

// =============================================================================
// Composants internes
// =============================================================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: typeof BarChart3;
  children: React.ReactNode;
}

function TabButton({ active, onClick, icon: Icon, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-fg-muted hover:text-fg hover:border-border',
      )}
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

function FilterGroup({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-fg-muted font-medium mb-1 flex items-center gap-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

interface ChartCardProps {
  title: string;
  subtitle: string;
  icon: typeof BarChart3;
  children: React.ReactNode;
}

function ChartCard({ title, subtitle, icon: Icon, children }: ChartCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-surface2 flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          <p className="text-[11px] text-fg-muted mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyPlaceholder() {
  return (
    <div className="text-center text-fg-muted text-xs py-12 italic">
      Pas assez de données pour ce graphique.
    </div>
  );
}

// =============================================================================
// Heatmap échéance × état (custom, pas dans Recharts)
// =============================================================================

interface HeatmapProps {
  cells: { mois: number; etat: string; nb: number }[];
}

function HeatmapEcheance({ cells }: HeatmapProps) {
  if (cells.length === 0) return <EmptyPlaceholder />;

  // Pivot cells → matrix [etat][mois]
  const etats: (keyof typeof ETAT_COLORS)[] = ['attente', 'enCours', 'realisee', 'ineligible'];
  const matrix = new Map<string, number>();
  let maxValue = 0;
  for (const c of cells) {
    matrix.set(`${c.etat}-${c.mois}`, c.nb);
    if (c.nb > maxValue) maxValue = c.nb;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left px-2 py-1 text-fg-muted font-semibold w-24"> </th>
            {MONTH_LABELS.map((m, i) => (
              <th
                key={i}
                className="text-center px-1 py-1 text-fg-muted font-mono text-[10px]"
              >
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {etats.map((etat) => (
            <tr key={etat}>
              <td className="px-2 py-1 text-fg-2 text-[11px] font-medium whitespace-nowrap">
                {ETAT_LABELS[etat]}
              </td>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((mois) => {
                const v = matrix.get(`${etat}-${mois}`) ?? 0;
                const intensity = maxValue > 0 ? v / maxValue : 0;
                const baseColor = ETAT_COLORS[etat];
                return (
                  <td key={mois} className="p-0.5">
                    <div
                      className="aspect-square flex items-center justify-center rounded text-[10px] font-semibold"
                      style={{
                        backgroundColor:
                          intensity > 0
                            ? `${baseColor}${Math.round(intensity * 255).toString(16).padStart(2, '0')}`
                            : '#F1F5F9',
                        color: intensity > 0.5 ? '#FFFFFF' : '#475569',
                        minHeight: 28,
                      }}
                      title={`${ETAT_LABELS[etat]} · ${MONTH_LABELS[mois - 1]} : ${v}`}
                    >
                      {v > 0 ? v : ''}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Funnel (custom : trapèzes empilés)
// =============================================================================

interface FunnelProps {
  etapes: { etat: string; nb: number }[];
}

function Funnel({ etapes }: FunnelProps) {
  // On garde l'ordre canonique : attente → en cours → réalisée (ineligible ignoré)
  const order = ['attente', 'enCours', 'realisee'];
  const filtered = etapes
    .filter((e) => order.includes(e.etat))
    .sort((a, b) => order.indexOf(a.etat) - order.indexOf(b.etat));

  if (filtered.length === 0 || filtered.every((e) => e.nb === 0)) {
    return <EmptyPlaceholder />;
  }

  const maxValue = Math.max(...filtered.map((e) => e.nb), 1);
  const total = filtered.reduce((s, e) => s + e.nb, 0);

  return (
    <div className="space-y-2 px-2 py-3">
      {filtered.map((e, i) => {
        const width = Math.max((e.nb / maxValue) * 100, 8);
        const color = ETAT_COLORS[e.etat as keyof typeof ETAT_COLORS];
        const pctOfTotal = total > 0 ? ((e.nb / total) * 100).toFixed(1) : '0';
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="w-24 text-right text-xs font-medium text-fg-2">
              {ETAT_LABELS[e.etat]}
            </div>
            <div className="flex-1">
              <div
                className="rounded-md flex items-center justify-end px-3 py-2.5 text-white text-sm font-semibold"
                style={{
                  width: `${width}%`,
                  backgroundColor: color,
                  minHeight: 32,
                }}
              >
                {e.nb}
              </div>
            </div>
            <div className="w-12 text-xs text-fg-muted text-right font-mono">{pctOfTotal} %</div>
          </div>
        );
      })}
    </div>
  );
}
