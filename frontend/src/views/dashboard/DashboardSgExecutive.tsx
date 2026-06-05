import { ChevronRight, Radio } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { BulletChart } from '../../components/dashboard/BulletChart.js';
import { DashboardMissionsMap } from '../../components/dashboard/DashboardMissionsMap.js';
import { cn } from '../../lib/cn.js';
import {
  computeAggregate,
  computeRecommandationsAggregate,
  type DashboardViewProps,
  type GlobalKpis,
  type SgSummaryResponse,
} from './types.js';

const DIRECTIVE_TARGET = 90;
const COPIL_TARGET = 60;

// =============================================================================
// Palettes
// =============================================================================

// Couleurs sémantiques (états)
const ETAT = {
  exec: { text: 'text-emerald-600', bar: 'bg-emerald-500', bg: 'bg-emerald-50', dot: '#16A34A' },
  attente: { text: 'text-amber-600', bar: 'bg-amber-500', bg: 'bg-amber-50', dot: '#D97706' },
  cours: { text: 'text-rose-600', bar: 'bg-rose-500', bg: 'bg-rose-50', dot: '#E11D48' },
} as const;

// Palette catégorielle cool (pour Recommandations par type)
const CATEGORY_PALETTE: { from: string; to: string; text: string }[] = [
  { from: 'from-cyan-300', to: 'to-cyan-500', text: 'text-cyan-700' },
  { from: 'from-indigo-300', to: 'to-indigo-500', text: 'text-indigo-700' },
  { from: 'from-purple-300', to: 'to-purple-500', text: 'text-purple-700' },
  { from: 'from-pink-300', to: 'to-pink-500', text: 'text-pink-700' },
  { from: 'from-teal-300', to: 'to-teal-500', text: 'text-teal-700' },
  { from: 'from-orange-300', to: 'to-orange-500', text: 'text-orange-700' },
];

// =============================================================================
// Composant principal
// =============================================================================

export function DashboardSgExecutive({ data, missions, anneeLabel, forPrint = false }: DashboardViewProps) {
  const navigate = useNavigate();
  const aggregate = computeAggregate(data.directives);
  const recoAggregate = computeRecommandationsAggregate(data.recommandationsParCategorie);

  // Sous-titre directives : si une année est filtrée, on détaille créées vs
  // reportées (ex: "14 directives · année 2026 (4 créées 2026 · 10 reportées :
  // 7 de 2024, 3 de 2025)").
  const det = data.directivesAnneeDetail;
  let directivesSubtitle = `${aggregate.totalDirectives} directives · ${anneeLabel}`;
  if (det && data.annee !== null && det.reportees > 0) {
    const origines = det.reporteesParAnnee.map((o) => `${o.n} de ${o.annee}`).join(', ');
    directivesSubtitle =
      `${det.total} directives · année ${data.annee} ` +
      `(${det.creeesEnAnnee} créée${det.creeesEnAnnee > 1 ? 's' : ''} en ${data.annee} · ` +
      `${det.reportees} reportée${det.reportees > 1 ? 's' : ''}${origines ? ` : ${origines}` : ''})`;
  } else if (det && data.annee !== null) {
    directivesSubtitle = `${det.total} directives · année ${data.annee} (toutes créées en ${data.annee})`;
  }

  return (
    <div className="grid grid-cols-12 gap-3">

      {/* ----- 1. Directives présidentielles ----- */}
      <BentoCard
        accent="green"
        title="Directives présidentielles"
        subtitle={directivesSubtitle}
        pulse
        detail={
          <DirectivesDetail
            data={data}
            navigate={navigate}
          />
        }
      >
        <DirectivesContent aggregate={aggregate} totalDirectives={aggregate.totalDirectives} />
      </BentoCard>

      {/* ----- 2. Recommandations MHA ----- */}
      <BentoCard
        accent="cyan"
        title="Recommandations MHA"
        subtitle={`${recoAggregate.total} reco · ${data.recommandationsParCategorie.length} catégories`}
        pulse
        detail={<RecommandationsDetail data={data} navigate={navigate} />}
      >
        <RecommandationsContent data={data} aggregate={recoAggregate} />
      </BentoCard>

      {/* ----- 3. COPIL · avancement par projet ----- */}
      <BentoCard
        accent="cyan"
        title="COPIL · avancement par projet"
        subtitle={`${data.copilProjets.length} projets pilotés · cible ${COPIL_TARGET}%`}
        pulse
        detail={
          <p className="text-sm text-fg-muted">
            Click sur un projet pour ouvrir sa matrice complète.
          </p>
        }
      >
        <CopilProjetsContent
          projets={data.copilProjets}
          target={COPIL_TARGET}
          onProjetClick={(code) => navigate(`/recommandations/copil?projet=${code}`)}
        />
      </BentoCard>

      {/* ----- 4. Missions terrain (6 cols) ----- */}
      <div className="col-span-12 lg:col-span-6">
        <BentoCardInner
          accent="cyan"
          title="Missions terrain"
          actionLabel="Voir tout"
          onAction={() => navigate('/missions-terrain')}
        >
          <MissionsContent missions={missions} />
        </BentoCardInner>
      </div>

      {/* ----- 5. Carte nationale (6 cols) — vraie carte OSM cadrée Sénégal ----- */}
      <div className="col-span-12 lg:col-span-6">
        <BentoCardInner
          title="Carte nationale"
          actionLabel="Plein écran"
          onAction={() => navigate('/missions-terrain')}
        >
          <div className="rounded-md overflow-hidden border border-border h-44">
            <DashboardMissionsMap items={missions} height={176} forPrint={forPrint} />
          </div>
          <p className="text-[11px] text-fg-muted mt-2 text-center">
            {missions.length} mission{missions.length > 1 ? 's' : ''} ·{' '}
            {data.missionsTerrain.regionsCouvertes} /{' '}
            {data.missionsTerrain.totalRegions} régions
          </p>
        </BentoCardInner>
      </div>

      {/* ----- 6. Activité trimestrielle ----- */}
      <BentoCard
        accent="cyan"
        title="Activité trimestrielle"
        subtitle={
          data.annee !== null
            ? `Réunions techniques + rencontres · année ${data.annee}`
            : 'Réunions techniques + rencontres · 4 trimestres roulants'
        }
        headerRight={<TrimestreCurrentChip data={data} />}
      >
        <TrimestresChart data={data.activiteParTrimestre} />
      </BentoCard>

      {/* ----- 7. Directives par année (informatif) ----- */}
      <BentoCard
        accent="green"
        title="Directives par année (exercice)"
        subtitle="Répartition informative — toutes années, par état. Indépendant du filtre."
      >
        <DirectivesParAnneeContent rows={data.directivesParAnnee} />
      </BentoCard>
    </div>
  );
}

// =============================================================================
// Directives par année — tableau informatif (tous états, toutes années)
// =============================================================================

function DirectivesParAnneeContent({
  rows,
}: {
  rows: SgSummaryResponse['directivesParAnnee'];
}) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-fg-muted text-center py-4">Aucune directive en base.</p>;
  }
  const maxTotal = Math.max(...rows.map((r) => r.total), 1);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.annee} className="grid grid-cols-[52px_1fr_auto] gap-3 items-center">
          <span className="font-mono text-sm font-bold tabular-nums">{r.annee}</span>
          {/* Barre empilée par état */}
          <div className="h-5 rounded bg-muted overflow-hidden flex" title={`${r.total} directives`}>
            <BarSeg value={r.realisee} max={maxTotal} color="#10B981" label="Réalisées" />
            <BarSeg value={r.enCours} max={maxTotal} color="#FB7185" label="En cours" />
            <BarSeg value={r.attente} max={maxTotal} color="#FBBF24" label="En attente" />
            <BarSeg value={r.ineligible} max={maxTotal} color="#94A3B8" label="Inéligibles" />
          </div>
          <span className="font-mono text-sm font-semibold tabular-nums text-right w-12">
            {r.total}
          </span>
        </div>
      ))}

      {/* Légende + total */}
      <div className="flex items-center justify-between pt-2 mt-1 border-t border-border">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fg-muted">
          <LegendDot color="#10B981" label="Réalisées" />
          <LegendDot color="#FB7185" label="En cours" />
          <LegendDot color="#FBBF24" label="En attente" />
          <LegendDot color="#94A3B8" label="Inéligibles" />
        </div>
        <span className="text-xs text-fg-muted">
          Total : <span className="font-mono font-bold text-fg">{grandTotal}</span>
        </span>
      </div>
    </div>
  );
}

function BarSeg({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
}) {
  if (value <= 0) return null;
  const pct = (value / max) * 100;
  return (
    <div
      style={{ width: `${pct}%`, backgroundColor: color }}
      className="h-full flex items-center justify-center"
      title={`${label} : ${value}`}
    >
      {pct > 8 && (
        <span className="text-[10px] font-bold text-white tabular-nums">{value}</span>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// =============================================================================
// BentoCard : carte avec accent + header + zone "Détail" expandable
// =============================================================================

type AccentColor = 'green' | 'cyan' | 'amber' | 'rose' | 'purple';

const ACCENT_BORDER: Record<AccentColor, string> = {
  green: 'border-l-emerald-500',
  cyan: 'border-l-cyan-600',
  amber: 'border-l-amber-500',
  rose: 'border-l-rose-500',
  purple: 'border-l-purple-500',
};

const ACCENT_DOT: Record<AccentColor, string> = {
  green: '#16A34A',
  cyan: '#0891B2',
  amber: '#D97706',
  rose: '#E11D48',
  purple: '#9333EA',
};

interface BentoCardProps {
  accent?: AccentColor;
  title: string;
  subtitle?: string;
  pulse?: boolean;
  headerRight?: ReactNode;
  detail?: ReactNode;
  children: ReactNode;
}

function BentoCard({
  accent,
  title,
  subtitle,
  pulse,
  headerRight,
  detail,
  children,
}: BentoCardProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className={cn(
        'col-span-12 bg-surface rounded-xl border border-border p-4 transition-all hover:border-fg-muted/40 hover:shadow-md',
        accent && 'border-l-[3px]',
        accent && ACCENT_BORDER[accent],
      )}
    >
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.08em] text-fg-muted font-semibold flex items-center gap-2">
            {pulse && accent && <PulseDot color={ACCENT_DOT[accent]} />}
            {title}
          </div>
          {subtitle && (
            <div className="text-[11px] text-fg-muted mt-0.5 leading-5">{subtitle}</div>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {headerRight}
          {detail && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-semibold text-cyan-700 hover:text-cyan-900"
            >
              Détail {expanded ? '↑' : '→'}
            </button>
          )}
        </div>
      </div>
      {children}
      {detail && expanded && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-fg-muted italic mb-3">↓ Vue détaillée</p>
          {detail}
        </div>
      )}
    </div>
  );
}

// Variante "inner" pour Missions / Carte qui sont déjà dans un col-span-6
interface BentoCardInnerProps {
  accent?: AccentColor;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}

function BentoCardInner({ accent, title, actionLabel, onAction, children }: BentoCardInnerProps) {
  return (
    <div
      className={cn(
        'bg-surface rounded-xl border border-border p-4 transition-all hover:border-fg-muted/40 hover:shadow-md h-full',
        accent && 'border-l-[3px]',
        accent && ACCENT_BORDER[accent],
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="text-[10.5px] uppercase tracking-[0.08em] text-fg-muted font-semibold">
          {title}
        </div>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="text-xs font-semibold text-cyan-700 hover:text-cyan-900"
          >
            {actionLabel} →
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function PulseDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
      style={{ background: color, boxShadow: `0 0 6px ${color}` }}
    />
  );
}

// =============================================================================
// Contenu : Directives
// =============================================================================

interface DirectivesContentProps {
  aggregate: GlobalKpis;
  totalDirectives: number;
}

function DirectivesContent({ aggregate, totalDirectives }: DirectivesContentProps) {
  const max = Math.max(
    aggregate.nbRealisees,
    aggregate.nbAttente,
    aggregate.nbEnCours,
    aggregate.nbIneligibles,
    1,
  );
  const etats = [
    {
      label: 'Exécuté',
      value: aggregate.nbRealisees,
      gradient: 'from-emerald-300 to-emerald-500',
      text: 'text-emerald-700',
    },
    {
      label: 'Attente',
      value: aggregate.nbAttente,
      gradient: 'from-amber-300 to-amber-500',
      text: 'text-amber-700',
    },
    {
      label: 'En cours',
      value: aggregate.nbEnCours,
      gradient: 'from-rose-300 to-rose-500',
      text: 'text-rose-700',
    },
    {
      label: 'Inéligible',
      value: aggregate.nbIneligibles,
      gradient: 'from-slate-300 to-slate-400',
      text: 'text-slate-600',
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-center">
      {/* Gauche : 3 % */}
      <div className="md:col-span-3">
        <div className="grid grid-cols-3 gap-2">
          <PercentStat
            label="Exécuté"
            percent={aggregate.tauxExecution}
            ratioNum={aggregate.nbRealisees}
            ratioDen={totalDirectives}
            variant="exec"
            compact
          />
          <PercentStat
            label="Attente"
            percent={pctSafe(aggregate.nbAttente, totalDirectives)}
            ratioNum={aggregate.nbAttente}
            ratioDen={totalDirectives}
            variant="attente"
            compact
          />
          <PercentStat
            label="Cours"
            percent={pctSafe(aggregate.nbEnCours, totalDirectives)}
            ratioNum={aggregate.nbEnCours}
            ratioDen={totalDirectives}
            variant="cours"
            compact
          />
        </div>
      </div>
      {/* Droite : barres horizontales par état (style "Par catégorie") */}
      <div className="md:col-span-4">
        <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold mb-2">
          Par état
        </div>
        <div className="space-y-1.5">
          {etats.map((e) => {
            const widthPct = Math.max((e.value / max) * 100, 2);
            return (
              <div key={e.label} className="flex items-center gap-2">
                <span className={cn('w-[4.5rem] text-xs font-semibold whitespace-nowrap', e.text)}>
                  {e.label}
                </span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full bg-gradient-to-r', e.gradient)}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-mono font-bold text-fg">
                  {e.value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface DirectivesDetailProps {
  data: SgSummaryResponse;
  navigate: ReturnType<typeof useNavigate>;
}

function DirectivesDetail({ data, navigate }: DirectivesDetailProps) {
  return (
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
  );
}

// =============================================================================
// Contenu : Recommandations
// =============================================================================

interface RecommandationsContentProps {
  data: SgSummaryResponse;
  aggregate: ReturnType<typeof computeRecommandationsAggregate>;
}

function RecommandationsContent({ data, aggregate }: RecommandationsContentProps) {
  const maxCat = Math.max(...data.recommandationsParCategorie.map((c) => c.recommandations), 1);
  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-center">
      <div className="md:col-span-3">
        <div className="grid grid-cols-3 gap-2">
          <PercentStat
            label="Exécuté"
            percent={aggregate.tauxExecution}
            ratioNum={aggregate.nbRealisees}
            ratioDen={aggregate.total}
            variant="exec"
            compact
          />
          <PercentStat
            label="Attente"
            percent={pctSafe(aggregate.nbAttente, aggregate.total)}
            ratioNum={aggregate.nbAttente}
            ratioDen={aggregate.total}
            variant="attente"
            compact
          />
          <PercentStat
            label="Cours"
            percent={pctSafe(aggregate.nbEnCours, aggregate.total)}
            ratioNum={aggregate.nbEnCours}
            ratioDen={aggregate.total}
            variant="cours"
            compact
          />
        </div>
      </div>
      <div className="md:col-span-4">
        <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold mb-2">
          Par catégorie
        </div>
        <div className="space-y-1.5">
          {data.recommandationsParCategorie.map((c, i) => {
            const palette =
              CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] ??
              (CATEGORY_PALETTE[0] as (typeof CATEGORY_PALETTE)[number]);
            const widthPct = Math.max((c.recommandations / maxCat) * 100, 2);
            return (
              <div key={c.code} className="flex items-center gap-2">
                <span className={cn('w-16 text-xs font-semibold', palette.text)}>{c.label}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full bg-gradient-to-r rounded-full', palette.from, palette.to)}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="w-6 text-right text-xs font-mono font-bold text-fg">
                  {c.recommandations}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface RecommandationsDetailProps {
  data: SgSummaryResponse;
  navigate: ReturnType<typeof useNavigate>;
}

function RecommandationsDetail({ data, navigate }: RecommandationsDetailProps) {
  return (
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
  );
}

// =============================================================================
// Contenu : COPIL projets
// =============================================================================

interface CopilProjetsContentProps {
  projets: SgSummaryResponse['copilProjets'];
  target: number;
  onProjetClick: (code: string) => void;
}

function CopilProjetsContent({ projets, target, onProjetClick }: CopilProjetsContentProps) {
  if (projets.length === 0) {
    return (
      <p className="text-sm text-fg-muted italic text-center py-4">
        Aucun projet COPIL configuré.
      </p>
    );
  }
  return (
    <>
      <div className="space-y-2">
        {projets.map((p) => (
          <CopilProjectRow
            key={p.code}
            projet={p}
            target={target}
            onClick={() => onProjetClick(p.code)}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] text-fg-muted mt-3 pt-2 border-t border-border flex-wrap gap-2">
        <span className="flex items-center gap-3 flex-wrap">
          <Legend color="bg-slate-400" label="non démarré (0%)" />
          <Legend color="bg-rose-500" label="à relancer" />
          <Legend color="bg-amber-500" label="en progression" />
          <Legend color="bg-emerald-500" label={`cible atteinte (≥${target}%)`} />
        </span>
        <span className="hidden sm:inline">| ligne cible {target}%</span>
      </div>
    </>
  );
}

interface CopilProjectRowProps {
  projet: SgSummaryResponse['copilProjets'][number];
  target: number;
  onClick: () => void;
}

function CopilProjectRow({ projet, target, onClick }: CopilProjectRowProps) {
  const pct = projet.tauxExecution;
  // 0% = pas démarré (neutre), >0% mais < cible = en progression, >= cible = atteinte
  const status: 'notStarted' | 'good' | 'mid' | 'bad' =
    pct === 0
      ? 'notStarted'
      : pct >= target
        ? 'good'
        : pct >= target * 0.66
          ? 'mid'
          : 'bad';
  const gradient = {
    notStarted: 'from-slate-300 to-slate-400',
    good: 'from-emerald-400 to-emerald-500',
    mid: 'from-amber-400 to-amber-500',
    bad: 'from-rose-400 to-rose-500',
  }[status];
  const textColor = {
    notStarted: 'text-fg-muted',
    good: 'text-emerald-700',
    mid: 'text-amber-700',
    bad: 'text-rose-700',
  }[status];

  // Retire le préfixe "COPIL " redondant — on est déjà dans la section COPIL
  const displayLabel = projet.label.replace(/^COPIL\s+/i, '');

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 hover:bg-muted/50 rounded-md px-1.5 py-1 -mx-1.5 transition-colors text-left"
    >
      <span className="w-24 text-xs font-semibold text-fg-2 whitespace-nowrap leading-5">
        {displayLabel}
      </span>
      <div className="flex-1 relative h-4 bg-muted rounded">
        <div
          className={cn('absolute inset-y-0 left-0 rounded bg-gradient-to-r', gradient)}
          style={{ width: `${Math.max(pct, 0.5)}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-fg/40"
          style={{ left: `${target}%` }}
        />
      </div>
      <span className={cn('w-12 text-right font-mono text-sm font-bold', textColor)}>
        {status === 'notStarted' ? '—' : `${Math.round(pct)}%`}
      </span>
      <span className="text-[10px] text-fg-muted font-mono w-12 text-right">
        {projet.nbRealisees}/{projet.total}
      </span>
    </button>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('inline-block w-2 h-2 rounded-sm', color)} />
      {label}
    </span>
  );
}

// =============================================================================
// Contenu : Missions terrain
// =============================================================================

interface MissionsContentProps {
  missions: DashboardViewProps['missions'];
}

function MissionsContent({ missions }: MissionsContentProps) {
  return (
    <>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-mono font-bold text-cyan-600">{missions.length}</span>
        <span className="text-xs text-fg-muted">
          site{missions.length > 1 ? 's' : ''} ·{' '}
          {new Set(missions.map((m) => m.region).filter(Boolean)).size} région
          {missions.length === 0 ? '' : 's'}
        </span>
      </div>
      <div className="space-y-1.5 text-xs leading-5 max-h-32 overflow-y-auto">
        {missions.slice(0, 5).map((m) => (
          <div key={m.id} className="flex items-center gap-2 text-fg-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 flex-shrink-0" />
            {/* Pas d'overflow-hidden (comme les libellés COPIL) : ça clippait
                le bas des lettres. whitespace-nowrap + leading-5 = lettres
                entières. */}
            <span className="whitespace-nowrap leading-5">
              <span className="font-medium">{m.localite}</span>
              {m.projetRattache && (
                <span className="text-fg-muted"> · {m.projetRattache}</span>
              )}
            </span>
          </div>
        ))}
        {missions.length === 0 && (
          <p className="text-fg-muted italic text-center py-2">Aucune mission saisie.</p>
        )}
      </div>
    </>
  );
}

// =============================================================================
// Contenu : Activité trimestrielle
// =============================================================================

interface TrimestresChartProps {
  data: SgSummaryResponse['activiteParTrimestre'];
}

function TrimestresChart({ data }: TrimestresChartProps) {
  const maxValue = Math.max(...data.map((t) => t.total), 1);
  const BAR_MAX = 100;
  const currentTrimestre = data[data.length - 1]?.trimestre;
  return (
    <>
      <div className="flex items-end justify-around gap-3 h-32 bg-muted rounded-md px-4 pt-2 pb-2 border border-border">
        {data.map((t) => {
          const isCurrent = t.trimestre === currentTrimestre;
          const heightPx = Math.max((t.total / maxValue) * BAR_MAX, 4);
          return (
            <div
              key={t.trimestre}
              className="flex-1 flex flex-col items-center justify-end h-full"
            >
              <div
                className={cn(
                  'text-xs font-mono font-bold mb-1',
                  isCurrent ? 'text-cyan-700' : 'text-fg-2',
                )}
              >
                {t.total}
              </div>
              <div
                className={cn(
                  'w-full max-w-[60px] rounded-t bg-gradient-to-b transition-all',
                  isCurrent
                    ? 'from-cyan-400 to-cyan-600 shadow-md'
                    : 'from-slate-300 to-slate-400 dark:from-slate-500 dark:to-slate-600',
                )}
                style={{ height: `${heightPx}px` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-around text-xs mt-2 font-mono font-semibold">
        {data.map((t) => {
          const isCurrent = t.trimestre === currentTrimestre;
          return (
            <span
              key={t.trimestre}
              className={cn(isCurrent ? 'text-cyan-700' : 'text-fg-muted')}
            >
              {t.trimestre}
              {isCurrent && ' ★'}
            </span>
          );
        })}
      </div>
    </>
  );
}

function TrimestreCurrentChip({ data }: { data: SgSummaryResponse }) {
  const currentTrim = data.activiteParTrimestre[data.activiteParTrimestre.length - 1];
  if (!currentTrim) return null;
  return (
    <div className="flex items-baseline gap-1.5 text-xs">
      <Radio className="w-3 h-3 text-cyan-600" />
      <span className="text-cyan-700 font-mono text-[10px]">
        trimestre {currentTrim.trimestre} ·
      </span>
      <span className="text-2xl font-mono font-bold text-cyan-600">{currentTrim.total}</span>
      <span className="text-fg-muted">activités</span>
    </div>
  );
}

// =============================================================================
// Composants atomiques
// =============================================================================

interface PercentStatProps {
  label: string;
  percent: number;
  ratioNum: number;
  ratioDen: number;
  variant: 'exec' | 'attente' | 'cours';
  compact?: boolean;
}

function PercentStat({ label, percent, ratioNum, ratioDen, variant, compact }: PercentStatProps) {
  const styles = ETAT[variant];
  return (
    <div>
      <div
        className={cn(
          'uppercase tracking-wider font-semibold',
          styles.text,
          compact ? 'text-[9.5px]' : 'text-[10px]',
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          'font-mono font-bold tabular-nums',
          styles.text,
          compact ? 'text-xl' : 'text-3xl',
        )}
      >
        {percent}
        <span className={compact ? 'text-xs' : 'text-base'}>%</span>
      </div>
      <div
        className={cn(
          'text-fg-muted font-mono',
          compact ? 'text-[9px]' : 'text-[10px]',
        )}
      >
        {ratioNum}/{ratioDen}
      </div>
    </div>
  );
}

function pctSafe(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

// =============================================================================
// Détail : DirectiveBulletCard + CategorieBulletCard (legacy)
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
    <div className="bg-muted/40 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between mb-2 gap-2">
        <h4 className="font-semibold text-sm">{title}</h4>
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center text-xs font-medium text-cyan-700 hover:underline"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span
          className={cn(
            'font-mono text-2xl font-bold tabular-nums',
            reached ? 'text-emerald-600' : 'text-fg',
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
        <span><b className="text-fg">{kpis.totalDirectives}</b> total</span>
        <span className="text-emerald-600"><b>{kpis.nbRealisees}</b> ✓</span>
        <span className="text-amber-600"><b>{kpis.nbEnCours}</b> cours</span>
        <span className="text-primary"><b>{kpis.nbAttente}</b> attente</span>
        <span className={kpis.nbRetards > 0 ? 'text-rose-600' : 'text-fg-muted'}>
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
    <div className="bg-muted/40 rounded-lg border border-border p-4">
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
          className="inline-flex items-center text-xs font-medium text-cyan-700 hover:underline"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span
          className={cn(
            'font-mono text-2xl font-bold tabular-nums',
            reached ? 'text-emerald-600' : 'text-fg',
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
        <span><b className="text-fg">{categorie.recommandations}</b> reco</span>
        <span className="text-emerald-600"><b>{categorie.nbRealisees}</b> ✓</span>
        <span className="text-amber-600"><b>{categorie.nbEnCours}</b> cours</span>
        <span className="text-primary"><b>{categorie.nbAttente}</b> attente</span>
      </div>
    </div>
  );
}
