import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { MissionsMap } from '../../components/dashboard/MissionsMap.js';
import { cn } from '../../lib/cn.js';
import { formatShort } from '../../lib/formatDate.js';
import { pct, type DashboardViewProps, type GlobalKpis } from './types.js';

export function DashboardSgBento({ data, missions, anneeLabel }: DashboardViewProps) {
  const navigate = useNavigate();

  return (
    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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

      {/* COPIL */}
      <BentoCard
        eyebrow="Recommandations MHA"
        title="COPIL"
        hero={data.copil.recommandations}
        heroLabel={`recommandations · ${data.copil.copilSuivis} COPIL`}
        progressLabel="Avancement"
        progressValue={pct(data.copil.nbRealisees, data.copil.recommandations)}
        chips={[
          { label: `${data.copil.nbEnCours} cours`, variant: 'warning' },
          { label: `${data.copil.nbAttente} attente`, variant: 'info' },
        ]}
        onClick={() => navigate('/recommandations/copil')}
      />

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

      {/* Carte nationale — span 2 colonnes */}
      <div className="bg-surface rounded-xl border border-border p-5 md:col-span-2 lg:col-span-3">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-primary-700 font-semibold">
              Terrain
            </div>
            <h3 className="text-base font-semibold mt-0.5">Carte nationale des missions</h3>
            <p className="text-xs text-fg-muted mt-0.5">
              {missions.length} site{missions.length > 1 ? 's' : ''} · {anneeLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/missions-terrain')}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Plein écran <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <MissionsMap items={missions} height={320} />
      </div>
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
