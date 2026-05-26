import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { BarList } from '../../components/dashboard/BarList.js';
import { BulletChart } from '../../components/dashboard/BulletChart.js';
import { MegaKpi } from '../../components/dashboard/MegaKpi.js';
import { MiniHistogram } from '../../components/dashboard/MiniHistogram.js';
import { MissionsMap } from '../../components/dashboard/MissionsMap.js';
import { cn } from '../../lib/cn.js';
import { formatShort } from '../../lib/formatDate.js';
import {
  computeAggregate,
  computeRecommandationsAggregate,
  formatMonthLabel,
  type DashboardViewProps,
  type GlobalKpis,
} from './types.js';

const DIRECTIVE_TARGET = 90;
const COPIL_TARGET = 60;
const DEFAULT_HEADER_LINK_CLASS =
  'inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline';

export function DashboardSgExecutive({ data, missions, anneeLabel }: DashboardViewProps) {
  const navigate = useNavigate();
  const aggregate = computeAggregate(data.directives);
  const recoAggregate = computeRecommandationsAggregate(data.recommandationsParCategorie);
  const reunionsBars = data.reunionsTechniques.parMois.map((p) => ({
    label: formatMonthLabel(p.yearMonth),
    value: p.count,
  }));

  return (
    <div className="space-y-6">
      {/* Section 1 : Directives présidentielles */}
      <section>
        <SectionHeader
          title="Directives présidentielles"
          subtitle="Suivi des directives issues des Conseils et instances de la Présidence"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <MegaKpi
            label="Total directives"
            value={aggregate.totalDirectives}
            delta={anneeLabel}
          />
          <MegaKpi
            label="Taux d'exécution"
            value={`${aggregate.tauxExecution} %`}
            delta={`${aggregate.nbRealisees} / ${aggregate.totalDirectives}`}
            variant={aggregate.tauxExecution >= DIRECTIVE_TARGET ? 'success' : 'default'}
          />
          <MegaKpi
            label="À relancer"
            value={aggregate.nbRetards}
            delta="échéances dépassées"
            variant={aggregate.nbRetards > 0 ? 'danger' : 'default'}
          />
          <MegaKpi
            label="En cours / attente"
            value={aggregate.nbEnCours + aggregate.nbAttente}
            delta={`${aggregate.nbEnCours} cours · ${aggregate.nbAttente} attente`}
            variant={aggregate.nbEnCours > 0 ? 'warning' : 'default'}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
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
      </section>

      <div className="border-t border-border" />

      {/* Section 2 : Recommandations MHA — une carte par catégorie */}
      <section>
        <SectionHeader
          title="Recommandations MHA"
          subtitle="Avancement par catégorie de matrices (COPIL, Réformes, CNGI, …)"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <MegaKpi
            label="Total recommandations"
            value={recoAggregate.total}
            delta={`${data.recommandationsParCategorie.length} catégorie${data.recommandationsParCategorie.length > 1 ? 's' : ''}`}
          />
          <MegaKpi
            label="Taux d'avancement"
            value={`${recoAggregate.tauxExecution} %`}
            delta={`${recoAggregate.nbRealisees} / ${recoAggregate.total}`}
            variant={recoAggregate.tauxExecution >= COPIL_TARGET ? 'success' : 'default'}
          />
          <MegaKpi
            label="En cours"
            value={recoAggregate.nbEnCours}
            delta="à finaliser"
            variant={recoAggregate.nbEnCours > 0 ? 'warning' : 'default'}
          />
          <MegaKpi
            label="En attente"
            value={recoAggregate.nbAttente}
            delta="pas démarrées"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          {data.recommandationsParCategorie.map((c) => (
            <CategorieBulletCard
              key={c.code}
              categorie={c}
              target={COPIL_TARGET}
              onClick={() => navigate(`/recommandations/${c.code}`)}
            />
          ))}
        </div>
      </section>

      <div className="border-t border-border" />

      {/* Section 3 : Activité du MHA */}
      <section>
        <SectionHeader
          title="Activité du MHA"
          subtitle="Réunions techniques, missions terrain et cartographie nationale"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          {/* Réunions techniques */}
          <div className="bg-surface rounded-xl border border-border p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-base">Réunions techniques</h3>
                <p className="text-xs text-fg-muted">{anneeLabel} · trend 6 mois glissants</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/reunions-techniques')}
                className={DEFAULT_HEADER_LINK_CLASS}
              >
                Détail <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <MiniHistogram bars={reunionsBars} height={56} />
            <div className="flex gap-4 text-xs mt-3 font-mono">
              <Metric value={data.reunionsTechniques.reunionsTenues} label="tenues" />
              {reunionsBars.length > 0 && (
                <span className="text-fg-muted">
                  ~{Math.round((data.reunionsTechniques.reunionsTenues || reunionsBars.reduce((a, b) => a + b.value, 0)) / Math.max(reunionsBars.length, 1))} / mois
                </span>
              )}
            </div>
          </div>

          {/* Missions terrain — résumé */}
          <div className="bg-surface rounded-xl border border-border p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-base">Missions terrain</h3>
                <p className="text-xs text-fg-muted">
                  Régions couvertes · {data.missionsTerrain.regionsCouvertes} /{' '}
                  {data.missionsTerrain.totalRegions}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/missions-terrain')}
                className={DEFAULT_HEADER_LINK_CLASS}
              >
                Détail <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-primary rounded-full"
                style={{
                  width: `${pctSafe(data.missionsTerrain.regionsCouvertes, data.missionsTerrain.totalRegions)}%`,
                }}
              />
            </div>
            <div className="flex items-center gap-3 text-xs">
              <Metric value={data.missionsTerrain.missionsEffectuees} label="missions" />
              <span className="text-fg-muted">
                Prochaine :{' '}
                <b className="text-fg">
                  {data.missionsTerrain.prochaineDate
                    ? formatShort(data.missionsTerrain.prochaineDate)
                    : 'n/a'}
                </b>
                {data.missionsTerrain.prochaineLocalite
                  ? ` · ${data.missionsTerrain.prochaineLocalite}`
                  : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Répartition des réunions techniques */}
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2">Répartition des réunions techniques</h3>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            <div className="bg-surface rounded-xl border border-border p-5">
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
            <div className="bg-surface rounded-xl border border-border p-5">
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
        </div>

        {/* Carte nationale + sites — toujours dans la section Activité MHA */}
        <div className="mt-4">
          <div className="flex items-end justify-between mb-2">
            <h3 className="text-sm font-semibold">Carte nationale des missions</h3>
            <button
              type="button"
              onClick={() => navigate('/missions-terrain')}
              className={DEFAULT_HEADER_LINK_CLASS}
            >
              Plein écran <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid gap-3 grid-cols-1 lg:grid-cols-[1.6fr_1fr]">
          <MissionsMap items={missions} height={420} />
          <div className="bg-surface rounded-lg border border-border overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-sm">Sites visités</h3>
              <span className="text-xs text-fg-muted">
                {missions.length} site{missions.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="overflow-auto" style={{ maxHeight: 420 }}>
              {missions.length === 0 ? (
                <p className="text-sm text-fg-muted text-center py-10">
                  Aucune mission pour {anneeLabel}.
                </p>
              ) : (
                missions.map((m) => (
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
                      {m.constats && (
                        <div className="text-xs text-fg-2 mt-1 line-clamp-1">{m.constats}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        </div>
      </section>
    </div>
  );
}

interface BulletCardProps {
  title: string;
  kpis: GlobalKpis;
  target: number;
  onClick: () => void;
}

function DirectiveBulletCard({ title, kpis, target, onClick }: BulletCardProps) {
  const reached = kpis.tauxExecution >= target;
  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <div className="flex items-start justify-between mb-3 gap-3">
        <h3 className="font-semibold text-base">{title}</h3>
        <div className="flex items-center gap-3">
          <GlobalPercent
            numerator={kpis.nbRealisees}
            denominator={kpis.totalDirectives}
            percent={kpis.tauxExecution}
            highlight={reached}
          />
          <button type="button" onClick={onClick} className={DEFAULT_HEADER_LINK_CLASS}>
            Détail <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <BulletChart
        value={kpis.tauxExecution}
        target={target}
        variant={reached ? 'success' : 'default'}
      />
      <div className="flex gap-4 text-xs mt-3 flex-wrap font-mono">
        <Metric value={kpis.totalDirectives} label="total" />
        <Metric value={kpis.nbRealisees} label="✓" variant="success" />
        <Metric value={kpis.nbEnCours} label="cours" variant="warning" />
        <Metric value={kpis.nbAttente} label="attente" variant="info" />
        <Metric value={kpis.nbRetards} label="retard" variant={kpis.nbRetards > 0 ? 'danger' : 'default'} />
      </div>
    </div>
  );
}

interface GlobalPercentProps {
  numerator: number;
  denominator: number;
  percent: number;
  highlight: boolean;
}

function GlobalPercent({ numerator, denominator, percent, highlight }: GlobalPercentProps) {
  return (
    <div className="text-right leading-none">
      <div
        className={cn(
          'font-mono text-2xl font-bold tabular-nums',
          highlight ? 'text-success' : 'text-fg',
        )}
      >
        {percent}%
      </div>
      <div className="text-[10.5px] text-fg-muted font-mono mt-0.5">
        {numerator} / {denominator}
      </div>
    </div>
  );
}

interface MetricProps {
  value: number;
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const METRIC_STYLES = {
  default: 'text-fg',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-primary',
} as const;

function Metric({ value, label, variant = 'default' }: MetricProps) {
  return (
    <span className={METRIC_STYLES[variant]}>
      <b className="text-base font-bold">{value}</b> <span className="text-fg-muted">{label}</span>
    </span>
  );
}

function pctSafe(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

interface SectionHeaderProps {
  title: string;
  subtitle: string;
}

function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-fg leading-tight">{title}</h2>
      <p className="text-xs text-fg-muted mt-0.5">{subtitle}</p>
    </div>
  );
}

interface CategorieBulletCardProps {
  categorie: {
    code: string;
    label: string;
    nbMatrices: number;
    recommandations: number;
    nbRealisees: number;
    nbEnCours: number;
    nbAttente: number;
  };
  target: number;
  onClick: () => void;
}

function CategorieBulletCard({ categorie, target, onClick }: CategorieBulletCardProps) {
  const pct = pctSafe(categorie.nbRealisees, categorie.recommandations);
  const reached = pct >= target;
  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div>
          <h3 className="font-semibold text-base">{categorie.label}</h3>
          <p className="text-xs text-fg-muted">
            {categorie.nbMatrices} matrice{categorie.nbMatrices > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <GlobalPercent
            numerator={categorie.nbRealisees}
            denominator={categorie.recommandations}
            percent={pct}
            highlight={reached}
          />
          <button type="button" onClick={onClick} className={DEFAULT_HEADER_LINK_CLASS}>
            Détail <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <BulletChart
        value={pct}
        target={target}
        threshold1={30}
        threshold2={60}
        variant={reached ? 'success' : 'default'}
      />
      <div className="flex gap-3 text-xs mt-3 flex-wrap font-mono">
        <Metric value={categorie.recommandations} label="reco" />
        <Metric value={categorie.nbRealisees} label="✓" variant="success" />
        <Metric value={categorie.nbEnCours} label="cours" variant="warning" />
        <Metric value={categorie.nbAttente} label="attente" variant="info" />
      </div>
    </div>
  );
}
