import { Landmark } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { MissionTerrain } from '@mha-bs/shared';

import { Spinner } from '../components/ui/Spinner.js';
import { useApi } from '../hooks/useApi.js';
import { api } from '../lib/apiClient.js';
import { cn } from '../lib/cn.js';
import { DashboardSgBento } from './dashboard/DashboardSgBento.js';
import { DashboardSgExecutive } from './dashboard/DashboardSgExecutive.js';
import { DashboardSgFocus } from './dashboard/DashboardSgFocus.js';
import type { SgSummaryResponse } from './dashboard/types.js';

const ANNEE_STORAGE_KEY = 'mha.dashboard.annee';
const LAYOUT_STORAGE_KEY = 'mha.dashboard.layout';
const CURRENT_YEAR = new Date().getUTCFullYear();

type Layout = 'executive' | 'bento' | 'focus';
const LAYOUTS: { key: Layout; label: string; hint: string }[] = [
  { key: 'executive', label: 'Executive', hint: 'KPI + bullet charts' },
  { key: 'bento', label: 'Bento', hint: 'Cartes compactes' },
  { key: 'focus', label: 'Focus', hint: 'Une catégorie à la fois' },
];

// Sentinel string used in <select> when the user picks "Toutes les années"
const ALL_YEARS = 'all';

function loadInitialAnnee(): number | null {
  if (typeof window === 'undefined') return CURRENT_YEAR;
  const raw = window.localStorage.getItem(ANNEE_STORAGE_KEY);
  if (raw === ALL_YEARS) return null;
  if (!raw) return CURRENT_YEAR;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : CURRENT_YEAR;
}

function loadInitialLayout(): Layout {
  if (typeof window === 'undefined') return 'executive';
  const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
  if (raw === 'executive' || raw === 'bento' || raw === 'focus') return raw;
  return 'executive';
}

export function DashboardView() {
  const [annee, setAnnee] = useState<number | null>(loadInitialAnnee);
  const [layout, setLayout] = useState<Layout>(loadInitialLayout);

  useEffect(() => {
    window.localStorage.setItem(ANNEE_STORAGE_KEY, annee === null ? ALL_YEARS : String(annee));
  }, [annee]);

  useEffect(() => {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
  }, [layout]);

  const summaryQuery = useApi(
    () =>
      api.get<SgSummaryResponse>('/dashboard/sg-summary', {
        query: annee !== null ? { annee } : {},
      }),
    [annee],
  );

  const missionsQuery = useApi(
    () =>
      api.get<{ items: MissionTerrain[] }>('/missions', {
        query: annee !== null ? { annee } : {},
      }),
    [annee],
  );

  const anneeLabel = annee === null ? 'toutes années' : `année ${annee}`;

  const yearsToShow = useMemo(() => {
    const set = new Set<number>(summaryQuery.data?.availableYears ?? []);
    set.add(CURRENT_YEAR);
    if (annee !== null) set.add(annee);
    return Array.from(set).sort((a, b) => b - a);
  }, [summaryQuery.data, annee]);

  if (summaryQuery.isLoading && !summaryQuery.data) {
    return <Spinner label="Chargement du dashboard…" />;
  }
  if (summaryQuery.error || !summaryQuery.data) {
    return (
      <div className="bg-danger-bg border border-danger text-danger rounded-lg px-4 py-3 text-sm">
        Impossible de charger le dashboard.
      </div>
    );
  }

  // Missions affichées : uniquement les données réelles de la base.
  const missions = missionsQuery.data?.items ?? [];

  // Recalcule les KPIs missions depuis la liste effective (gère le filtre année).
  const regionsCouvertesEffectif = new Set(
    missions.map((m) => m.region).filter((r) => Boolean(r)) as string[],
  ).size;
  const nextProchaine = missions
    .filter((m) => m.dateMission && new Date(m.dateMission) >= new Date())
    .sort((a, b) => (a.dateMission ?? '').localeCompare(b.dateMission ?? ''))[0];

  const dataWithLiveMissions: SgSummaryResponse = {
    ...summaryQuery.data,
    missionsTerrain: {
      ...summaryQuery.data.missionsTerrain,
      missionsEffectuees: missions.length,
      regionsCouvertes: regionsCouvertesEffectif,
      prochaineDate: nextProchaine?.dateMission ?? summaryQuery.data.missionsTerrain.prochaineDate,
      prochaineLocalite:
        nextProchaine?.localite ?? summaryQuery.data.missionsTerrain.prochaineLocalite,
    },
  };

  const childProps = { data: dataWithLiveMissions, missions, annee, anneeLabel };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-primary-100 text-primary-700 rounded text-[11.5px] font-semibold uppercase tracking-wider mb-2">
            <Landmark className="w-3.5 h-3.5" /> Vue Secrétaire général
          </div>
          <h1 className="text-2xl font-semibold text-fg leading-tight">Dashboard global</h1>
          <p className="text-sm text-fg-muted mt-1">
            Synthèse de l&apos;activité du Bureau de Suivi · {anneeLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex bg-surface border border-border rounded-lg p-0.5">
            {LAYOUTS.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => setLayout(l.key)}
                title={l.hint}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  layout === l.key
                    ? 'bg-primary text-white'
                    : 'text-fg-muted hover:text-fg hover:bg-muted',
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-fg-muted">
            Année
            <select
              value={annee === null ? ALL_YEARS : String(annee)}
              onChange={(e) => {
                const v = e.target.value;
                setAnnee(v === ALL_YEARS ? null : Number(v));
              }}
              className="rounded border border-border bg-surface px-3 py-1.5 text-sm font-mono text-fg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value={ALL_YEARS}>Toutes les années</option>
              {yearsToShow.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {layout === 'executive' && <DashboardSgExecutive {...childProps} />}
      {layout === 'bento' && <DashboardSgBento {...childProps} />}
      {layout === 'focus' && <DashboardSgFocus {...childProps} />}
    </div>
  );
}
