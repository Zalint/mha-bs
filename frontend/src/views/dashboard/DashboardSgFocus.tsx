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
  formatMonthLabel,
  pct,
  type DashboardViewProps,
  type GlobalKpis,
} from './types.js';

type CategoryKey =
  | 'conseilMinistres'
  | 'conseilInterMinisteriel'
  | 'coordinationSggSg'
  | 'copil'
  | 'reunions'
  | 'missions';

interface ChipDef {
  key: CategoryKey;
  label: string;
  badge: number;
}

export function DashboardSgFocus({ data, missions, anneeLabel }: DashboardViewProps) {
  const navigate = useNavigate();
  const [active, setActive] = useState<CategoryKey>('conseilMinistres');

  const chips: ChipDef[] = [
    {
      key: 'conseilMinistres',
      label: 'Conseil ministres',
      badge: data.directives.conseilMinistres.totalDirectives,
    },
    {
      key: 'conseilInterMinisteriel',
      label: 'Conseil inter',
      badge: data.directives.conseilInterMinisteriel.totalDirectives,
    },
    {
      key: 'coordinationSggSg',
      label: 'SGG/SG',
      badge: data.directives.coordinationSggSg.totalDirectives,
    },
    { key: 'copil', label: 'COPIL', badge: data.copil.recommandations },
    {
      key: 'reunions',
      label: 'Réunions',
      badge: data.reunionsTechniques.reunionsTenues,
    },
    { key: 'missions', label: 'Missions', badge: data.missionsTerrain.missionsEffectuees },
  ];

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 sticky top-0 bg-bg/95 backdrop-blur z-10">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setActive(c.key)}
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

      <div className="mt-4">
        {active === 'conseilMinistres' && (
          <DirectivePanel
            title="Conseil des ministres"
            subtitle={`Directives issues des Conseils des ministres · ${anneeLabel}`}
            kpis={data.directives.conseilMinistres}
            onNavigate={() => navigate('/directives/conseil-ministres')}
          />
        )}
        {active === 'conseilInterMinisteriel' && (
          <DirectivePanel
            title="Conseil inter-ministériel"
            subtitle={`Directives issues des Conseils et réunions interministériels · ${anneeLabel}`}
            kpis={data.directives.conseilInterMinisteriel}
            onNavigate={() => navigate('/directives/conseil-interministeriel')}
          />
        )}
        {active === 'coordinationSggSg' && (
          <DirectivePanel
            title="Coordination SGG/SG"
            subtitle={`Directives issues des réunions de coordination avec les Secrétaires généraux · ${anneeLabel}`}
            kpis={data.directives.coordinationSggSg}
            onNavigate={() => navigate('/directives/coordination-sg')}
          />
        )}
        {active === 'copil' && (
          <Panel
            title="COPIL · portefeuille MHA"
            subtitle="Recommandations issues des comités de pilotage · tous COPIL confondus"
            onNavigate={() => navigate('/recommandations/copil')}
          >
            <StatStrip
              cells={[
                { label: 'COPIL suivis', value: data.copil.copilSuivis, subtitle: 'Portefeuille MHA' },
                {
                  label: 'Recommandations',
                  value: data.copil.recommandations,
                  subtitle: 'tous COPIL',
                },
                {
                  label: 'Réalisées',
                  value: data.copil.nbRealisees,
                  subtitle: `${pct(data.copil.nbRealisees, data.copil.recommandations)} %`,
                  variant: 'success',
                },
                { label: 'En cours', value: data.copil.nbEnCours, variant: 'warning' },
                { label: 'En attente', value: data.copil.nbAttente, variant: 'info' },
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
