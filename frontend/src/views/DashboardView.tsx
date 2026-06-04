import { FileDown, Info, Landmark, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

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
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const pdfContentRef = useRef<HTMLDivElement>(null);

  /**
   * Hard refresh : recharge la page en bypassant tout cache (équivalent
   * Ctrl+Shift+R). Ajoute un cache-buster `?_=timestamp` à l'URL avant
   * de recharger pour forcer le navigateur à re-fetch les ressources.
   */
  const handleHardRefresh = (): void => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('_', Date.now().toString());
      // window.location.reload() ne bypass pas toujours le HTTP cache —
      // l'ajout du timestamp + assignement à href force un fetch frais.
      window.location.href = url.toString();
    } catch {
      // fallback simple si URL pas dispo (très anciens browsers)
      window.location.reload();
    }
  };

  const handleGeneratePdf = async (): Promise<void> => {
    if (!pdfContentRef.current) return;
    setGeneratingPdf(true);
    // Laisse React faire un re-render (passage Leaflet -> SVG dans les layouts)
    // avant de demander a html2canvas de capturer le DOM. Deux frames =
    // 1 re-render React + 1 layout/paint navigateur.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    try {
      // Import dynamique pour ne pas alourdir le bundle initial
      const html2pdf = (await import('html2pdf.js')).default;
      const today = new Date().toISOString().slice(0, 10);
      const filename = `MHA-dashboard-${anneeLabel.replace(/\s+/g, '-')}-${today}.pdf`;
      // html2pdf().set() prend un objet d'options ; pagebreak est supporté mais
      // pas typé dans @types/html2pdf.js. On caste pour s'en accommoder.
      const opts: Record<string, unknown> = {
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#F8FAFC' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (html2pdf() as any).set(opts).from(pdfContentRef.current).save();
      toast.success(`PDF généré : ${filename}`);
    } catch (err) {
      toast.error(`Erreur génération PDF : ${err instanceof Error ? err.message : 'inconnue'}`);
    } finally {
      setGeneratingPdf(false);
    }
  };

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
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 lg:gap-4 mb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-primary-100 text-primary-700 rounded text-[11.5px] font-semibold uppercase tracking-wider mb-2">
            <Landmark className="w-3.5 h-3.5" /> Vue Secrétaire général
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-fg leading-tight">
            Dashboard global
          </h1>
          <p className="text-xs sm:text-sm text-fg-muted mt-1">
            Synthèse de l&apos;activité du Bureau de Suivi · {anneeLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
          <button
            type="button"
            onClick={handleHardRefresh}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm border border-border bg-surface hover:bg-muted text-fg-2 hover:text-fg transition-colors"
            aria-label="Rafraîchir la page (hard refresh)"
            title="Hard refresh (équivalent Ctrl+Shift+R)"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Rafraîchir</span>
          </button>
          <button
            type="button"
            onClick={() => void handleGeneratePdf()}
            disabled={generatingPdf}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all',
              'bg-gradient-to-r from-primary to-primary-700 text-white',
              generatingPdf && 'opacity-70 cursor-wait',
            )}
            aria-label="Générer un PDF du dashboard"
          >
            {generatingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {generatingPdf ? 'Génération…' : 'Générer PDF'}
            </span>
            <span className="sm:hidden">PDF</span>
          </button>
          <div className="flex bg-surface border border-border rounded-lg p-0.5">
            {LAYOUTS.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => setLayout(l.key)}
                title={l.hint}
                className={cn(
                  'px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-colors',
                  layout === l.key
                    ? 'bg-primary text-white'
                    : 'text-fg-muted hover:text-fg hover:bg-muted',
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
          <label
            className="flex items-center gap-2 text-xs sm:text-sm text-fg-muted"
            title={
              "Directives : 'active pendant N' (visible si émise pendant ou avant N et non close début N — gère les directives pluri-annuelles).\n" +
              "Réunions / missions : événements de l'année N (date dans l'année)."
            }
          >
            Année active
            <Info className="w-3 h-3" />
            <select
              value={annee === null ? ALL_YEARS : String(annee)}
              onChange={(e) => {
                const v = e.target.value;
                setAnnee(v === ALL_YEARS ? null : Number(v));
              }}
              className="rounded border border-border bg-surface px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-mono text-fg focus:outline-none focus:ring-2 focus:ring-primary"
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

      <div ref={pdfContentRef}>
        {layout === 'executive' && <DashboardSgExecutive {...childProps} forPrint={generatingPdf} />}
        {layout === 'bento' && <DashboardSgBento {...childProps} forPrint={generatingPdf} />}
        {layout === 'focus' && <DashboardSgFocus {...childProps} forPrint={generatingPdf} />}
      </div>
    </div>
  );
}
