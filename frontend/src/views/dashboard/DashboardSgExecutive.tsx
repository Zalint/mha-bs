import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { BarList } from '../../components/dashboard/BarList.js';
import { BulletChart } from '../../components/dashboard/BulletChart.js';
import { ExpandableCard } from '../../components/dashboard/ExpandableCard.js';
import { MegaKpi } from '../../components/dashboard/MegaKpi.js';
import { MissionsMap } from '../../components/dashboard/MissionsMap.js';
import { VerticalBarChart, type BarItem } from '../../components/dashboard/VerticalBarChart.js';
import { cn } from '../../lib/cn.js';
import { formatShort } from '../../lib/formatDate.js';
import {
  computeAggregate,
  computeRecommandationsAggregate,
  type DashboardViewProps,
  type GlobalKpis,
  type SgSummaryResponse,
} from './types.js';

const DIRECTIVE_TARGET = 90;
const COPIL_TARGET = 60;
const DEFAULT_HEADER_LINK_CLASS =
  'inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline';

// =============================================================================
// Palettes
// =============================================================================

// Sémantique état (vert/orange/rouge) — utilisée Section 1 + Section 2 "Par état"
const ETAT_COLORS = {
  exec: { color: '#16A34A', light: '#4ADE80' },
  attente: { color: '#F59E0B', light: '#FBBF24' },
  cours: { color: '#DC2626', light: '#F87171' },
} as const;

// Palette cool catégorielle — Section 2 "Par type" (distinct des états)
const TYPE_COLORS: { color: string; light: string }[] = [
  { color: '#0EA5E9', light: '#7DD3FC' }, // sky
  { color: '#6366F1', light: '#A5B4FC' }, // indigo
  { color: '#A855F7', light: '#D8B4FE' }, // purple
  { color: '#EC4899', light: '#F9A8D4' }, // pink
  { color: '#14B8A6', light: '#5EEAD4' }, // teal
  { color: '#F97316', light: '#FB923C' }, // orange
];

// Nuancier bleu — Section 3 trimestres
const TRIM_COLORS: { color: string; light: string }[] = [
  { color: '#93C5FD', light: '#DBEAFE' },
  { color: '#60A5FA', light: '#93C5FD' },
  { color: '#3B82F6', light: '#60A5FA' },
  { color: '#1D4ED8', light: '#3B82F6' },
];

const ACCENT_ETAT = 'linear-gradient(90deg, #16A34A 0%, #F59E0B 50%, #DC2626 100%)';
const ACCENT_TYPE = 'linear-gradient(90deg, #0EA5E9 0%, #6366F1 33%, #A855F7 66%, #EC4899 100%)';
const ACCENT_TRIM = 'linear-gradient(90deg, #DBEAFE 0%, #3B82F6 100%)';

// =============================================================================
// Helpers
// =============================================================================

type RecoMode = 'total' | 'realisee' | 'attente' | 'enCours';

const RECO_MODE_LABELS: Record<RecoMode, string> = {
  total: 'Total',
  realisee: 'Exécuté',
  attente: 'Attente',
  enCours: 'Cours',
};

function pctSafe(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function recoValueForMode(
  c: SgSummaryResponse['recommandationsParCategorie'][number],
  mode: RecoMode,
): number {
  if (mode === 'total') return c.recommandations;
  if (mode === 'realisee') return c.nbRealisees;
  if (mode === 'attente') return c.nbAttente;
  return c.nbEnCours;
}

// =============================================================================
// Composant principal
// =============================================================================

export function DashboardSgExecutive({ data, missions, anneeLabel }: DashboardViewProps) {
  const navigate = useNavigate();
  const aggregate = computeAggregate(data.directives);
  const recoAggregate = computeRecommandationsAggregate(data.recommandationsParCategorie);

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* SECTION 1 : Directives présidentielles                             */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-lg font-semibold text-fg">Directives présidentielles</h2>
          <span className="text-xs text-fg-muted">
            {aggregate.totalDirectives} directives · {anneeLabel}
          </span>
        </div>
        <ExpandableCard
          title="Vue globale"
          subtitle="Conseil ministres + Inter-ministériel + Coordination SGG/SG"
          detail={
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <DirectiveBulletCard
                title="Conseil des ministres"
                kpis={data.directives.conseilMinistres}
                target={DIRECTIVE_TARGET}
                onClick={() => navigate('/directives/conseil-ministres')}
              />
              <DirectiveBulletCard
                title="Conseil inter-ministériel"
                kpis={data.directives.conseilInterMinisteriel}
                target={DIRECTIVE_TARGET}
                onClick={() => navigate('/directives/conseil-interministeriel')}
              />
              <DirectiveBulletCard
                title="Coordination SGG/SG"
                kpis={data.directives.coordinationSggSg}
                target={DIRECTIVE_TARGET}
                onClick={() => navigate('/directives/coordination-sg')}
              />
            </div>
          }
        >
          <StatePercentsBar
            total={aggregate.totalDirectives}
            executed={aggregate.nbRealisees}
            attente={aggregate.nbAttente}
            enCours={aggregate.nbEnCours}
          />
          <div className="mt-4">
            <VerticalBarChart
              bars={[
                {
                  label: 'Exécuté',
                  value: aggregate.nbRealisees,
                  color: ETAT_COLORS.exec.color,
                  colorLight: ETAT_COLORS.exec.light,
                },
                {
                  label: 'En attente',
                  value: aggregate.nbAttente,
                  color: ETAT_COLORS.attente.color,
                  colorLight: ETAT_COLORS.attente.light,
                },
                {
                  label: 'En cours',
                  value: aggregate.nbEnCours,
                  color: ETAT_COLORS.cours.color,
                  colorLight: ETAT_COLORS.cours.light,
                },
              ]}
              accentGradient={ACCENT_ETAT}
              title="Répartition par état"
            />
          </div>
        </ExpandableCard>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 2 : Recommandations MHA                                    */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-lg font-semibold text-fg">Recommandations MHA</h2>
          <span className="text-xs text-fg-muted">
            {recoAggregate.total} recommandations toutes catégories
          </span>
        </div>
        <ExpandableCard
          title="Vue globale"
          subtitle={`${data.recommandationsParCategorie.length} catégorie${data.recommandationsParCategorie.length > 1 ? 's' : ''} : COPIL + CNGI + Réformes + autres`}
          detail={
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.recommandationsParCategorie.map((c) => (
                <CategorieBulletCard
                  key={c.code}
                  categorie={c}
                  target={COPIL_TARGET}
                  onClick={() => navigate(`/recommandations/${c.code}`)}
                />
              ))}
            </div>
          }
        >
          <RecommandationsSimplifiedContent data={data} aggregate={recoAggregate} />
        </ExpandableCard>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 3 : Activité du MHA                                        */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-lg font-semibold text-fg">Activité du MHA</h2>
          <span className="text-xs text-fg-muted">
            Réunions + rencontres · {anneeLabel}
          </span>
        </div>
        <ExpandableCard
          title="Vue globale"
          subtitle="Réunions techniques + rencontres (CM, CIM, Coordination) · missions terrain"
          detail={<ActiviteDetail data={data} missions={missions} anneeLabel={anneeLabel} navigate={navigate} />}
        >
          <ActiviteSimplifiedContent data={data} missions={missions} navigate={navigate} />
        </ExpandableCard>
      </section>
    </div>
  );
}

// =============================================================================
// Section 1 — Helpers Directives
// =============================================================================

interface StatePercentsBarProps {
  total: number;
  executed: number;
  attente: number;
  enCours: number;
}

function StatePercentsBar({ total, executed, attente, enCours }: StatePercentsBarProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <PercentCell
        label="Exécuté"
        value={pctSafe(executed, total)}
        absoluteValue={executed}
        absoluteTotal={total}
        bg="bg-success-bg"
        text="text-success"
        border="border-success/30"
      />
      <PercentCell
        label="En attente"
        value={pctSafe(attente, total)}
        absoluteValue={attente}
        absoluteTotal={total}
        bg="bg-warning-bg"
        text="text-warning"
        border="border-warning/30"
      />
      <PercentCell
        label="En cours"
        value={pctSafe(enCours, total)}
        absoluteValue={enCours}
        absoluteTotal={total}
        bg="bg-danger-bg"
        text="text-danger"
        border="border-danger/30"
      />
    </div>
  );
}

interface PercentCellProps {
  label: string;
  value: number;
  absoluteValue: number;
  absoluteTotal: number;
  bg: string;
  text: string;
  border: string;
}

function PercentCell({
  label,
  value,
  absoluteValue,
  absoluteTotal,
  bg,
  text,
  border,
}: PercentCellProps) {
  return (
    <div className={cn('text-center p-3 rounded-lg border', bg, border)}>
      <div className={cn('font-mono text-2xl sm:text-3xl font-bold', text)}>
        {value}
        <span className="text-base sm:text-lg">%</span>
      </div>
      <div
        className={cn(
          'text-[10.5px] sm:text-[11px] uppercase tracking-wider font-semibold mt-1',
          text,
        )}
      >
        {label}
      </div>
      <div className="text-[10px] text-fg-muted mt-0.5 font-mono">
        {absoluteValue} / {absoluteTotal}
      </div>
    </div>
  );
}

// =============================================================================
// Section 2 — Helpers Recommandations
// =============================================================================

interface RecoSimplifiedProps {
  data: SgSummaryResponse;
  aggregate: ReturnType<typeof computeRecommandationsAggregate>;
}

function RecommandationsSimplifiedContent({ data, aggregate }: RecoSimplifiedProps) {
  const [mode, setMode] = useState<RecoMode>('total');

  // Bars Par état (3 barres, basé sur l'agrégat)
  const etatBars: BarItem[] = [
    {
      label: 'Exécuté',
      value: aggregate.nbRealisees,
      color: ETAT_COLORS.exec.color,
      colorLight: ETAT_COLORS.exec.light,
    },
    {
      label: 'En attente',
      value: aggregate.nbAttente,
      color: ETAT_COLORS.attente.color,
      colorLight: ETAT_COLORS.attente.light,
    },
    {
      label: 'En cours',
      value: aggregate.nbEnCours,
      color: ETAT_COLORS.cours.color,
      colorLight: ETAT_COLORS.cours.light,
    },
  ];

  // Bars Par type (couleurs cool, dynamique selon mode)
  const typeBars: BarItem[] = data.recommandationsParCategorie.map((c, i) => {
    const palette = TYPE_COLORS[i % TYPE_COLORS.length] as { color: string; light: string };
    return {
      label: c.label,
      value: recoValueForMode(c, mode),
      color: palette.color,
      colorLight: palette.light,
    };
  });

  return (
    <>
      <StatePercentsBar
        total={aggregate.total}
        executed={aggregate.nbRealisees}
        attente={aggregate.nbAttente}
        enCours={aggregate.nbEnCours}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-3 mt-4">
        <VerticalBarChart
          bars={etatBars}
          accentGradient={ACCENT_ETAT}
          title="Par état d'avancement"
        />
        <VerticalBarChart
          bars={typeBars}
          accentGradient={ACCENT_TYPE}
          title="Par type de catégorie"
          titleAction={
            <div className="inline-flex gap-0.5 p-0.5 bg-muted border border-border rounded-md">
              {(Object.keys(RECO_MODE_LABELS) as RecoMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    'px-2 py-1 rounded text-[11px] font-medium transition-colors',
                    mode === m
                      ? 'bg-surface text-fg shadow-sm'
                      : 'text-fg-2 hover:text-fg',
                  )}
                >
                  {RECO_MODE_LABELS[m]}
                </button>
              ))}
            </div>
          }
        />
      </div>
      {/* Légende des types */}
      <div className="mt-3 flex flex-wrap gap-3 sm:gap-4 justify-center text-[11px] text-fg-muted">
        {data.recommandationsParCategorie.map((c, i) => {
          const palette = TYPE_COLORS[i % TYPE_COLORS.length] as { color: string };
          return (
            <span key={c.code} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded"
                style={{ background: palette.color }}
              />
              {c.label}
            </span>
          );
        })}
      </div>
    </>
  );
}

// =============================================================================
// Section 3 — Helpers Activité MHA
// =============================================================================

interface ActiviteSimplifiedProps {
  data: SgSummaryResponse;
  missions: DashboardViewProps['missions'];
  navigate: ReturnType<typeof useNavigate>;
}

function ActiviteSimplifiedContent({ data, missions, navigate }: ActiviteSimplifiedProps) {
  const trimestreBars: BarItem[] = useMemo(() => {
    return data.activiteParTrimestre.map((t, i) => {
      const palette = TRIM_COLORS[i % TRIM_COLORS.length] as { color: string; light: string };
      return {
        label: t.trimestre,
        value: t.total,
        color: palette.color,
        colorLight: palette.light,
      };
    });
  }, [data.activiteParTrimestre]);

  const totalActivite = trimestreBars.reduce((sum, b) => sum + b.value, 0);
  const currentTrim = data.activiteParTrimestre[data.activiteParTrimestre.length - 1];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <VerticalBarChart
          bars={trimestreBars}
          accentGradient={ACCENT_TRIM}
          title="Activité par trimestre"
        />
        <p className="text-[11px] text-fg-muted mt-2 text-center">
          {totalActivite} activité{totalActivite > 1 ? 's' : ''} cumulée
          {totalActivite > 1 ? 's' : ''}
          {currentTrim
            ? ` · trimestre courant : ${currentTrim.trimestre} (${currentTrim.total})`
            : ''}
        </p>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
            Carte des missions terrain
          </div>
          <button
            type="button"
            onClick={() => navigate('/missions-terrain')}
            className={DEFAULT_HEADER_LINK_CLASS}
          >
            Plein écran <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <MissionsMap items={missions} height={220} />
        <p className="text-[11px] text-fg-muted mt-2 text-center">
          {missions.length} mission{missions.length > 1 ? 's' : ''} ·{' '}
          {data.missionsTerrain.regionsCouvertes} /{' '}
          {data.missionsTerrain.totalRegions} région
          {data.missionsTerrain.totalRegions > 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}

interface ActiviteDetailProps {
  data: SgSummaryResponse;
  missions: DashboardViewProps['missions'];
  anneeLabel: string;
  navigate: ReturnType<typeof useNavigate>;
}

function ActiviteDetail({ data, missions, anneeLabel, navigate }: ActiviteDetailProps) {
  return (
    <div className="space-y-4">
      {/* MegaKpi */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MegaKpi
          label="Réunions tenues"
          value={data.reunionsTechniques.reunionsTenues}
          delta={anneeLabel}
        />
        <MegaKpi
          label="Missions effectuées"
          value={data.missionsTerrain.missionsEffectuees}
          delta={anneeLabel}
        />
        <MegaKpi
          label="Régions couvertes"
          value={`${data.missionsTerrain.regionsCouvertes} / ${data.missionsTerrain.totalRegions}`}
          delta="Sénégal"
        />
        <MegaKpi
          label="Prochaine mission"
          value={
            data.missionsTerrain.prochaineDate
              ? formatShort(data.missionsTerrain.prochaineDate)
              : '—'
          }
          delta={data.missionsTerrain.prochaineLocalite ?? 'aucune planifiée'}
          variant="default"
        />
      </div>

      {/* Répartitions */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
        <div className="bg-surface rounded-xl border border-border p-4">
          <h4 className="text-sm font-semibold mb-3">Par sous-secteur</h4>
          <BarList
            items={data.reunionsTechniques.parSousSecteur.map((s) => ({
              label: s.label,
              value: s.count,
            }))}
            emptyMessage="Aucune réunion catégorisée pour cette période."
            labelWidth={160}
          />
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <h4 className="text-sm font-semibold mb-3">Par projet / COPIL rattaché</h4>
          <BarList
            items={data.reunionsTechniques.parCopil.map((s) => ({
              label: s.copil,
              value: s.count,
            }))}
            emptyMessage="Aucune réunion rattachée à un COPIL pour cette période."
            labelWidth={120}
          />
        </div>
      </div>

      {/* Sites visités */}
      <div>
        <div className="flex items-end justify-between mb-2">
          <h4 className="text-sm font-semibold">Sites visités</h4>
          <button
            type="button"
            onClick={() => navigate('/missions-terrain')}
            className={DEFAULT_HEADER_LINK_CLASS}
          >
            Voir tout <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="bg-surface rounded-lg border border-border overflow-hidden">
          {missions.length === 0 ? (
            <p className="text-sm text-fg-muted text-center py-6">
              Aucune mission pour {anneeLabel}.
            </p>
          ) : (
            missions.slice(0, 6).map((m) => (
              <div
                key={m.id}
                className="grid grid-cols-[32px_1fr] gap-3 px-4 py-3 border-b border-border last:border-0 items-start"
              >
                <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-mono font-semibold text-[10.5px]">
                  {m.localite.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{m.localite}</div>
                  <div className="text-[11.5px] text-fg-muted font-mono truncate">
                    {m.projetRattache ?? '—'} · {m.region ?? '—'} ·{' '}
                    {m.dateMission ? formatShort(m.dateMission) : '—'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Composants pour la zone "Détail" (legacy, repris de l'ancienne implémentation)
// =============================================================================

interface BulletCardProps {
  title: string;
  kpis: GlobalKpis;
  target: number;
  onClick: () => void;
}

function DirectiveBulletCard({ title, kpis, target, onClick }: BulletCardProps) {
  const reached = kpis.tauxExecution >= target;
  return (
    <div className="bg-surface2 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between mb-2 gap-2">
        <h4 className="font-semibold text-sm">{title}</h4>
        <button
          type="button"
          onClick={onClick}
          className={DEFAULT_HEADER_LINK_CLASS}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span
          className={cn(
            'font-mono text-2xl font-bold tabular-nums',
            reached ? 'text-success' : 'text-fg',
          )}
        >
          {kpis.tauxExecution}%
        </span>
        <span className="text-[10.5px] text-fg-muted font-mono">
          {kpis.nbRealisees} / {kpis.totalDirectives}
        </span>
      </div>
      <BulletChart
        value={kpis.tauxExecution}
        target={target}
        variant={reached ? 'success' : 'default'}
      />
      <div className="flex gap-3 text-[11px] mt-2 flex-wrap font-mono text-fg-muted">
        <span>
          <b className="text-fg">{kpis.totalDirectives}</b> total
        </span>
        <span className="text-success">
          <b>{kpis.nbRealisees}</b> ✓
        </span>
        <span className="text-warning">
          <b>{kpis.nbEnCours}</b> cours
        </span>
        <span className="text-primary">
          <b>{kpis.nbAttente}</b> attente
        </span>
        <span className={kpis.nbRetards > 0 ? 'text-danger' : 'text-fg-muted'}>
          <b>{kpis.nbRetards}</b> retard
        </span>
      </div>
    </div>
  );
}

interface CategorieBulletCardProps {
  categorie: SgSummaryResponse['recommandationsParCategorie'][number];
  target: number;
  onClick: () => void;
}

function CategorieBulletCard({ categorie, target, onClick }: CategorieBulletCardProps) {
  const pct = pctSafe(categorie.nbRealisees, categorie.recommandations);
  const reached = pct >= target;
  return (
    <div className="bg-surface2 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between mb-2 gap-2">
        <div>
          <h4 className="font-semibold text-sm">{categorie.label}</h4>
          <p className="text-[11px] text-fg-muted">
            {categorie.nbMatrices} matrice{categorie.nbMatrices > 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClick}
          className={DEFAULT_HEADER_LINK_CLASS}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span
          className={cn(
            'font-mono text-2xl font-bold tabular-nums',
            reached ? 'text-success' : 'text-fg',
          )}
        >
          {pct}%
        </span>
        <span className="text-[10.5px] text-fg-muted font-mono">
          {categorie.nbRealisees} / {categorie.recommandations}
        </span>
      </div>
      <BulletChart
        value={pct}
        target={target}
        threshold1={30}
        threshold2={60}
        variant={reached ? 'success' : 'default'}
      />
      <div className="flex gap-3 text-[11px] mt-2 flex-wrap font-mono text-fg-muted">
        <span>
          <b className="text-fg">{categorie.recommandations}</b> reco
        </span>
        <span className="text-success">
          <b>{categorie.nbRealisees}</b> ✓
        </span>
        <span className="text-warning">
          <b>{categorie.nbEnCours}</b> cours
        </span>
        <span className="text-primary">
          <b>{categorie.nbAttente}</b> attente
        </span>
      </div>
    </div>
  );
}
