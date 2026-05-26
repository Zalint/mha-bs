import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { BarList } from '../../components/dashboard/BarList.js';
import { MegaKpi } from '../../components/dashboard/MegaKpi.js';
import { MissionsMap } from '../../components/dashboard/MissionsMap.js';
import { cn } from '../../lib/cn.js';
import { formatShort } from '../../lib/formatDate.js';
import {
  computeAggregate,
  computeRecommandationsAggregate,
  pct,
  type DashboardViewProps,
  type GlobalKpis,
} from './types.js';

const DIRECTIVE_TARGET = 90;
const RECO_TARGET = 60;

export function DashboardSgBento({ data, missions, anneeLabel }: DashboardViewProps) {
  const navigate = useNavigate();
  const aggregate = computeAggregate(data.directives);
  const recoAggregate = computeRecommandationsAggregate(data.recommandationsParCategorie);

  return (
    <div className="space-y-6">
      {/* Section 1 : Directives présidentielles */}
      <section>
        <BentoSectionHeader
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
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-3">
          <DirectiveBentoCard
            eyebrow="Directive présidentielle"
            title="Conseil des ministres"
            kpis={data.directives.conseilMinistres}
            anneeLabel={anneeLabel}
            onClick={() => navigate('/directives/conseil-ministres')}
          />
          <DirectiveBentoCard
            eyebrow="Directive présidentielle"
            title="Conseil inter-ministériel"
            kpis={data.directives.conseilInterMinisteriel}
            anneeLabel={anneeLabel}
            onClick={() => navigate('/directives/conseil-interministeriel')}
          />
          <DirectiveBentoCard
            eyebrow="Directive présidentielle"
            title="Coordination SGG/SG"
            kpis={data.directives.coordinationSggSg}
            anneeLabel={anneeLabel}
            onClick={() => navigate('/directives/coordination-sg')}
          />
        </div>
      </section>

      <div className="border-t border-border" />

      {/* Section 2 : Recommandations MHA */}
      <section>
        <BentoSectionHeader
          title="Recommandations MHA"
          subtitle="Avancement par catégorie de matrices"
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
            variant={recoAggregate.tauxExecution >= RECO_TARGET ? 'success' : 'default'}
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
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-3">
          {data.recommandationsParCategorie.map((c) => (
            <BentoCard
              key={c.code}
              eyebrow="Recommandations MHA"
              title={c.label}
              hero={c.recommandations}
              heroLabel={`reco · ${c.nbMatrices} matrice${c.nbMatrices > 1 ? 's' : ''}`}
              progressLabel="Avancement"
              progressValue={pct(c.nbRealisees, c.recommandations)}
              chips={[
                ...(c.nbEnCours > 0
                  ? [{ label: `${c.nbEnCours} cours`, variant: 'warning' as const }]
                  : []),
                ...(c.nbAttente > 0
                  ? [{ label: `${c.nbAttente} attente`, variant: 'info' as const }]
                  : []),
              ]}
              onClick={() => navigate(`/recommandations/${c.code}`)}
            />
          ))}
        </div>
      </section>

      <div className="border-t border-border" />

      {/* Section 3 : Activité du MHA */}
      <section>
        <BentoSectionHeader
          title="Activité du MHA"
          subtitle="Réunions techniques, missions terrain et cartographie"
        />
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-3">
          {/* Réunions */}
          <BentoCard
            eyebrow="Activité MHA"
            title="Réunions techniques"
            hero={data.reunionsTechniques.reunionsTenues}
            heroLabel={`tenues · ${anneeLabel}`}
            onClick={() => navigate('/reunions-techniques')}
          />

          {/* Missions terrain — résumé */}
          <BentoCard
            eyebrow="Terrain"
            title="Suivi missions terrain"
            hero={data.missionsTerrain.missionsEffectuees}
            heroLabel={`missions · ${data.missionsTerrain.regionsCouvertes}/${data.missionsTerrain.totalRegions} régions`}
            footer={
          data.missionsTerrain.prochaineDate ? (
            <div className="rounded-lg bg-primary-100 px-3 py-2">
              <div className="text-[10.5px] uppercase tracking-wider text-primary-700 font-semibold">
                Prochaine mission
              </div>
              <div className="text-sm font-semibold mt-0.5">
                {formatShort(data.missionsTerrain.prochaineDate)}
                {data.missionsTerrain.prochaineLocalite
                  ? ` · ${data.missionsTerrain.prochaineLocalite}`
                  : ''}
              </div>
            </div>
          ) : null
        }
            onClick={() => navigate('/missions-terrain')}
          />
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

        {/* Carte nationale + liste des sites */}
        <div className="mt-4">
          <div className="flex items-end justify-between mb-2">
            <h3 className="text-sm font-semibold">Carte nationale des missions · {missions.length} site{missions.length > 1 ? 's' : ''}</h3>
            <button
              type="button"
              onClick={() => navigate('/missions-terrain')}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Plein écran <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid gap-3 grid-cols-1 lg:grid-cols-[1.6fr_1fr]">
          <MissionsMap items={missions} height={420} />
          <div className="bg-surface rounded-lg border border-border overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h4 className="font-semibold text-sm">Sites visités</h4>
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

interface BentoSectionHeaderProps {
  title: string;
  subtitle: string;
}

function BentoSectionHeader({ title, subtitle }: BentoSectionHeaderProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-fg leading-tight">{title}</h2>
      <p className="text-xs text-fg-muted mt-0.5">{subtitle}</p>
    </div>
  );
}

interface DirectiveBentoProps {
  eyebrow: string;
  title: string;
  kpis: GlobalKpis;
  anneeLabel: string;
  onClick: () => void;
}

function DirectiveBentoCard({ eyebrow, title, kpis, anneeLabel, onClick }: DirectiveBentoProps) {
  return (
    <BentoCard
      eyebrow={eyebrow}
      title={title}
      hero={kpis.totalDirectives}
      heroLabel={`directives · ${anneeLabel}`}
      progressLabel="Taux d'exécution"
      progressValue={kpis.tauxExecution}
      chips={[
        { label: `${kpis.nbEnCours} cours`, variant: 'warning' },
        { label: `${kpis.nbAttente} attente`, variant: 'info' },
        ...(kpis.nbRetards > 0
          ? [{ label: `${kpis.nbRetards} retard${kpis.nbRetards > 1 ? 's' : ''}`, variant: 'danger' as const }]
          : []),
      ]}
      onClick={onClick}
    />
  );
}

interface BentoChip {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

interface BentoCardProps {
  eyebrow: string;
  title: string;
  hero: number;
  heroLabel: string;
  progressLabel?: string;
  progressValue?: number;
  chips?: BentoChip[];
  footer?: React.ReactNode;
  onClick: () => void;
}

const CHIP_STYLES = {
  default: 'bg-muted text-fg-2',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-primary-100 text-primary-700',
} as const;

function BentoCard({
  eyebrow,
  title,
  hero,
  heroLabel,
  progressLabel,
  progressValue,
  chips,
  footer,
  onClick,
}: BentoCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-surface rounded-xl border border-border p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-primary-700 font-semibold">
            {eyebrow}
          </div>
          <h3 className="text-base font-semibold mt-0.5">{title}</h3>
        </div>
        <ChevronRight className="w-4 h-4 text-fg-muted" />
      </div>
      <div className="flex items-end gap-3 mb-3">
        <div className="font-mono text-4xl font-bold leading-none">{hero}</div>
        <div className="text-xs text-fg-muted pb-1">{heroLabel}</div>
      </div>
      {progressValue !== undefined && (
        <div className="mb-3">
          <div className="flex justify-between text-[11px] text-fg-muted mb-1">
            <span>{progressLabel}</span>
            <span
              className={cn(
                'font-mono font-semibold',
                progressValue >= 90 ? 'text-success' : progressValue >= 50 ? 'text-fg' : 'text-fg-muted',
              )}
            >
              {progressValue} %
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full', progressValue >= 90 ? 'bg-success' : 'bg-primary')}
              style={{ width: `${Math.max(0, Math.min(100, progressValue))}%` }}
            />
          </div>
        </div>
      )}
      {chips && chips.length > 0 && (
        <div className="flex gap-2 text-[11px] flex-wrap">
          {chips.map((c) => (
            <span
              key={c.label}
              className={cn('px-2 py-0.5 rounded font-medium font-mono', CHIP_STYLES[c.variant ?? 'default'])}
            >
              {c.label}
            </span>
          ))}
        </div>
      )}
      {footer}
    </button>
  );
}
