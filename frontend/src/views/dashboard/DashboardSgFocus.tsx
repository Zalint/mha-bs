import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { BarList } from '../../components/dashboard/BarList.js';
import { MiniHistogram } from '../../components/dashboard/MiniHistogram.js';
import { MissionsMap } from '../../components/dashboard/MissionsMap.js';
import { StatStrip, type StatCell } from '../../components/ui/StatStrip.js';
import { cn } from '../../lib/cn.js';
import { formatShort } from '../../lib/formatDate.js';
import {
  computeAggregate,
  computeRecommandationsAggregate,
  formatMonthLabel,
  pct,
  type DashboardViewProps,
  type GlobalKpis,
} from './types.js';

const DIRECTIVE_TARGET = 90;
const RECO_TARGET = 60;

// Clé d'onglet préfixée pour éviter les collisions :
//   dir:<typeRencontre>  pour les 3 directives
//   reco:<categoryCode>  pour chaque catégorie de matrices (dynamique)
//   reunions / missions  pour l'activité
type ActiveKey = string;

interface ChipDef {
  key: ActiveKey;
  label: string;
  badge: number;
}

export function DashboardSgFocus({ data, missions, anneeLabel }: DashboardViewProps) {
  const navigate = useNavigate();
  const [active, setActive] = useState<ActiveKey>('dir:conseilMinistres');

  const directiveAggregate = computeAggregate(data.directives);
  const recoAggregate = computeRecommandationsAggregate(data.recommandationsParCategorie);

  const directiveChips: ChipDef[] = [
    {
      key: 'dir:conseilMinistres',
      label: 'Conseil ministres',
      badge: data.directives.conseilMinistres.totalDirectives,
    },
    {
      key: 'dir:conseilInterMinisteriel',
      label: 'Conseil inter',
      badge: data.directives.conseilInterMinisteriel.totalDirectives,
    },
    {
      key: 'dir:coordinationSggSg',
      label: 'SGG/SG',
      badge: data.directives.coordinationSggSg.totalDirectives,
    },
  ];

  // Une chip par catégorie de recommandations (driven by referentiel)
  const recoChips: ChipDef[] = data.recommandationsParCategorie.map((c) => ({
    key: `reco:${c.code}`,
    label: c.label,
    badge: c.recommandations,
  }));

  const activityChips: ChipDef[] = [
    {
      key: 'reunions',
      label: 'Réunions',
      badge: data.reunionsTechniques.reunionsTenues,
    },
    { key: 'missions', label: 'Missions', badge: data.missionsTerrain.missionsEffectuees },
  ];

  const activeRecoCategorie = active.startsWith('reco:')
    ? data.recommandationsParCategorie.find((c) => `reco:${c.code}` === active)
    : null;

  return (
    <div>
      <div className="sticky top-0 bg-bg/95 backdrop-blur z-10 pb-2 space-y-2">
        <ChipGroup
          label="Directives présidentielles"
          total={{
            realisees: directiveAggregate.nbRealisees,
            total: directiveAggregate.totalDirectives,
            percent: directiveAggregate.tauxExecution,
            target: DIRECTIVE_TARGET,
          }}
          chips={directiveChips}
          active={active}
          onSelect={setActive}
        />
        <ChipGroup
          label="Recommandations MHA"
          total={{
            realisees: recoAggregate.nbRealisees,
            total: recoAggregate.total,
            percent: recoAggregate.tauxExecution,
            target: RECO_TARGET,
          }}
          chips={recoChips}
          active={active}
          onSelect={setActive}
        />
        <ChipGroup
          label="Activité du MHA"
          chips={activityChips}
          active={active}
          onSelect={setActive}
        />
      </div>

      <div className="mt-4">
        {active === 'dir:conseilMinistres' && (
          <DirectivePanel
            title="Conseil des ministres"
            subtitle={`Directives issues des Conseils des ministres · ${anneeLabel}`}
            kpis={data.directives.conseilMinistres}
            onNavigate={() => navigate('/directives/conseil-ministres')}
          />
        )}
        {active === 'dir:conseilInterMinisteriel' && (
          <DirectivePanel
            title="Conseil inter-ministériel"
            subtitle={`Directives issues des Conseils et réunions interministériels · ${anneeLabel}`}
            kpis={data.directives.conseilInterMinisteriel}
            onNavigate={() => navigate('/directives/conseil-interministeriel')}
          />
        )}
        {active === 'dir:coordinationSggSg' && (
          <DirectivePanel
            title="Coordination SGG/SG"
            subtitle={`Directives issues des réunions de coordination avec les Secrétaires généraux · ${anneeLabel}`}
            kpis={data.directives.coordinationSggSg}
            onNavigate={() => navigate('/directives/coordination-sg')}
          />
        )}
        {activeRecoCategorie && (
          <Panel
            title={`${activeRecoCategorie.label} · recommandations`}
            subtitle={`${activeRecoCategorie.nbMatrices} matrice${activeRecoCategorie.nbMatrices > 1 ? 's' : ''} dans cette catégorie · indépendant de l'année`}
            onNavigate={() => navigate(`/recommandations/${activeRecoCategorie.code}`)}
          >
            <StatStrip
              cells={[
                {
                  label: 'Matrices',
                  value: activeRecoCategorie.nbMatrices,
                  subtitle: 'dans la catégorie',
                },
                {
                  label: 'Recommandations',
                  value: activeRecoCategorie.recommandations,
                  subtitle: 'au total',
                },
                {
                  label: 'Réalisées',
                  value: activeRecoCategorie.nbRealisees,
                  subtitle: `${pct(activeRecoCategorie.nbRealisees, activeRecoCategorie.recommandations)} %`,
                  variant: 'success',
                },
                { label: 'En cours', value: activeRecoCategorie.nbEnCours, variant: 'warning' },
                { label: 'En attente', value: activeRecoCategorie.nbAttente, variant: 'info' },
              ]}
            />
          </Panel>
        )}
        {active === 'reunions' && (
          <Panel
            title="Réunions techniques"
            subtitle={`Activité du MHA · ${anneeLabel}`}
            onNavigate={() => navigate('/reunions-techniques')}
          >
            <StatStrip
              cells={[
                {
                  label: 'Réunions tenues',
                  value: data.reunionsTechniques.reunionsTenues,
                  subtitle: anneeLabel,
                },
              ]}
            />
            <div className="card mt-4">
              <div className="card-header">
                <h3 className="text-md font-semibold">Trend · 6 derniers mois</h3>
              </div>
              <div className="card-body">
                <MiniHistogram
                  bars={data.reunionsTechniques.parMois.map((p) => ({
                    label: formatMonthLabel(p.yearMonth),
                    value: p.count,
                  }))}
                  height={120}
                />
              </div>
            </div>
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 mt-3">
              <div className="card">
                <div className="card-header">
                  <h3 className="text-md font-semibold">Par sous-secteur</h3>
                </div>
                <div className="card-body">
                  <BarList
                    items={data.reunionsTechniques.parSousSecteur.map((s) => ({
                      label: s.label,
                      value: s.count,
                    }))}
                    emptyMessage="Aucune réunion catégorisée."
                    labelWidth={160}
                  />
                </div>
              </div>
              <div className="card">
                <div className="card-header">
                  <h3 className="text-md font-semibold">Par projet / COPIL</h3>
                </div>
                <div className="card-body">
                  <BarList
                    items={data.reunionsTechniques.parCopil.map((s) => ({
                      label: s.copil,
                      value: s.count,
                    }))}
                    emptyMessage="Aucune réunion rattachée à un COPIL."
                    labelWidth={120}
                  />
                </div>
              </div>
            </div>
          </Panel>
        )}
        {active === 'missions' && (
          <Panel
            title="Suivi missions terrain"
            subtitle={`Sites d'ouvrages visités · ${anneeLabel}`}
            onNavigate={() => navigate('/missions-terrain')}
          >
            <StatStrip
              cells={[
                {
                  label: 'Missions effectuées',
                  value: data.missionsTerrain.missionsEffectuees,
                  subtitle: anneeLabel,
                },
                {
                  label: 'Régions couvertes',
                  value: `${data.missionsTerrain.regionsCouvertes} / ${data.missionsTerrain.totalRegions}`,
                  subtitle: 'sur le Sénégal',
                },
                {
                  label: 'Prochaine mission',
                  value: data.missionsTerrain.prochaineDate
                    ? formatShort(data.missionsTerrain.prochaineDate)
                    : '—',
                  subtitle: data.missionsTerrain.prochaineLocalite ?? 'aucune planifiée',
                  variant: 'info',
                },
              ]}
            />
            <div className="mt-4">
              <h3 className="text-md font-semibold mb-2">Carte nationale</h3>
              <MissionsMap items={missions} height={420} />
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

interface DirectivePanelProps {
  title: string;
  subtitle: string;
  kpis: GlobalKpis;
  onNavigate: () => void;
}

function DirectivePanel({ title, subtitle, kpis, onNavigate }: DirectivePanelProps) {
  const cells: StatCell[] = [
    { label: 'Total', value: kpis.totalDirectives, subtitle: 'depuis 2024' },
    { label: 'Réalisées', value: kpis.nbRealisees, subtitle: `${kpis.tauxExecution} %`, variant: 'success' },
    {
      label: 'En cours',
      value: kpis.nbEnCours,
      subtitle: `${pct(kpis.nbEnCours, kpis.totalDirectives)} %`,
      variant: 'warning',
    },
    {
      label: 'En attente',
      value: kpis.nbAttente,
      subtitle: `${pct(kpis.nbAttente, kpis.totalDirectives)} %`,
      variant: 'info',
    },
    { label: 'Inéligibles', value: kpis.nbIneligibles, subtitle: 'hors périmètre' },
    {
      label: 'Échéance dépassée',
      value: kpis.nbRetards,
      subtitle: 'à relancer',
      variant: 'danger',
    },
  ];
  return (
    <Panel title={title} subtitle={subtitle} onNavigate={onNavigate}>
      <StatStrip cells={cells} />
    </Panel>
  );
}

interface ChipGroupProps {
  label: string;
  total?: { realisees: number; total: number; percent: number; target?: number };
  chips: ChipDef[];
  active: ActiveKey;
  onSelect: (key: ActiveKey) => void;
}

function ChipGroup({ label, total, chips, active, onSelect }: ChipGroupProps) {
  if (chips.length === 0) return null;
  const highlight = total !== undefined && total.target !== undefined && total.percent >= total.target;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5 px-1">
        <span className="text-[10.5px] uppercase tracking-wider text-fg-muted font-semibold">
          {label}
        </span>
        {total && (
          <span className="text-[11px] font-mono text-fg-muted">
            <b className={cn('font-bold', highlight ? 'text-success' : 'text-fg')}>{total.percent}%</b>
            <span className="opacity-70"> · {total.realisees}/{total.total}</span>
          </span>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onSelect(c.key)}
            className={cn(
              'shrink-0 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors',
              active === c.key
                ? 'bg-primary text-white'
                : 'bg-surface border border-border hover:bg-muted',
            )}
          >
            {c.label}
            <span
              className={cn(
                'font-mono px-1.5 py-0.5 rounded text-[10.5px]',
                active === c.key ? 'bg-white/20' : 'bg-muted',
              )}
            >
              {c.badge}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface PanelProps {
  title: string;
  subtitle: string;
  onNavigate: () => void;
  children: React.ReactNode;
}

function Panel({ title, subtitle, onNavigate, children }: PanelProps) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-fg-muted mt-0.5">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onNavigate}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Voir le détail <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      {children}
    </section>
  );
}
