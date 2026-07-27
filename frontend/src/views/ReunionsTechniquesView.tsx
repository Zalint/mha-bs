import {
  Calendar,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Download,
  ExternalLink,
  FolderKanban,
  Plus,
  Recycle,
  Shuffle,
  Trash2,
  Waves,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type { ReunionTechnique, SousSecteur } from '@mha-bs/shared';

import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { KpiCard } from '../components/ui/KpiCard.js';
import { Spinner } from '../components/ui/Spinner.js';
import { useApi } from '../hooks/useApi.js';
import { api, formatApiError } from '../lib/apiClient.js';
import { cn } from '../lib/cn.js';
import { formatShort } from '../lib/formatDate.js';

const SOUS_SECTEUR_DEF: { key: SousSecteur; label: string; color: string; icon: typeof Calendar }[] = [
  { key: 'eau', label: 'Sous-secteur Eau (accès)', color: '#0284C7', icon: Waves },
  { key: 'gire', label: 'GIRE (ressources en eau)', color: '#06B6D4', icon: Waves },
  { key: 'assainissement', label: 'Assainissement (eaux usées)', color: '#0891B2', icon: Recycle },
  { key: 'inondations', label: 'Eaux pluviales / Inondations', color: '#0EA5E9', icon: CloudRain },
  { key: 'transversal', label: 'Projets transversaux', color: '#0369A1', icon: Shuffle },
  { key: 'reformeInstitutionnelle', label: 'Réforme institutionnelle', color: '#155E75', icon: FolderKanban },
];

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

interface CalendarEvent {
  day: number;
  theme: string;
  sousSecteurs: SousSecteur[];
  /** false = saisie restée à l'étape 1, visible seulement par son auteur. */
  visibleSg: boolean;
}

/** Valeur sentinelle du <select> pour « toutes les années ». */
const TOUTES_ANNEES = 'all';
const ANNEE_STORAGE_KEY = 'mha.reunions.annee';

function anneeInitiale(): number | null {
  const courante = new Date().getUTCFullYear();
  if (typeof window === 'undefined') return courante;
  const raw = window.localStorage.getItem(ANNEE_STORAGE_KEY);
  if (raw === TOUTES_ANNEES) return null;
  if (!raw) return courante;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : courante;
}

/**
 * Année d'une réunion, extraite de `dateReunion` au format YYYY-MM-DD.
 * Découpage de chaîne et non `new Date()` : une date sans heure est interprétée
 * en UTC, et un `getFullYear()` local ferait basculer le 1er janvier sur
 * l'année précédente à l'ouest de Greenwich.
 */
function anneeReunion(r: ReunionTechnique): number | null {
  if (!r.dateReunion) return null;
  const y = Number(r.dateReunion.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

export function ReunionsTechniquesView() {
  const navigate = useNavigate();
  const [monthOffset, setMonthOffset] = useState(0);

  const reunionsQuery = useApi(() => api.get<{ items: ReunionTechnique[] }>('/reunions'), []);
  const toutesReunions = useMemo(() => reunionsQuery.data?.items ?? [], [reunionsQuery.data]);

  // === Filtre année ===
  // Même mécanique que Suivi missions terrain : année en cours par défaut,
  // mémorisée, avec « Toutes les années ». Le filtre s'applique ICI, a la
  // source : calendrier, KPI, répartition par sous-secteur et agenda derivent
  // tous de `reunions` et suivent donc automatiquement.
  const [annee, setAnnee] = useState<number | null>(anneeInitiale);
  useEffect(() => {
    window.localStorage.setItem(ANNEE_STORAGE_KEY, annee === null ? TOUTES_ANNEES : String(annee));
  }, [annee]);

  const anneesDisponibles = useMemo(() => {
    const set = new Set<number>();
    for (const r of toutesReunions) {
      const y = anneeReunion(r);
      if (y !== null) set.add(y);
    }
    set.add(new Date().getUTCFullYear());
    if (annee !== null) set.add(annee);
    return Array.from(set).sort((a, b) => b - a);
  }, [toutesReunions, annee]);

  const reunions = useMemo(
    () =>
      annee === null ? toutesReunions : toutesReunions.filter((r) => anneeReunion(r) === annee),
    [toutesReunions, annee],
  );

  const anneeLabel = annee === null ? 'toutes années' : `année ${annee}`;

  // Suppression d'une réunion (confirmation via ConfirmDialog — jamais confirm()).
  const [aSupprimer, setASupprimer] = useState<ReunionTechnique | null>(null);
  const demanderSuppression = (r: ReunionTechnique): void => setASupprimer(r);
  const confirmerSuppression = async (): Promise<void> => {
    if (!aSupprimer) return;
    try {
      await api.delete(`/reunions/${aSupprimer.id}`);
      toast.success('Réunion supprimée');
      setASupprimer(null);
      reunionsQuery.refetch();
    } catch (err) {
      // L'API refuse (403) si l'utilisateur n'est ni le créateur ni admin.
      toast.error(formatApiError(err, 'Suppression impossible'));
    }
  };

  // Changer d'année remet le calendrier sur le mois de reference de cette
  // annee : sans ca, un decalage accumule sur l'annee precedente resterait
  // applique et afficherait un mois sans rapport.
  useEffect(() => {
    setMonthOffset(0);
  }, [annee]);

  // Determine displayed month based on most recent reunion + offset
  const referenceDate = useMemo(() => {
    if (reunions.length === 0) return new Date();
    const dates = reunions.map((r) => new Date(`${r.dateReunion}T00:00:00Z`));
    const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
    return new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() + monthOffset, 1));
  }, [reunions, monthOffset]);

  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();

  const monthLabel = referenceDate.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const eventsByDay = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    for (const r of reunions) {
      const d = new Date(`${r.dateReunion}T00:00:00Z`);
      if (d.getUTCFullYear() === year && d.getUTCMonth() === month) {
        const day = d.getUTCDate();
        if (!map[day]) map[day] = [];
        map[day].push({ day, theme: r.theme, sousSecteurs: r.sousSecteurs, visibleSg: r.visibleSg });
      }
    }
    return map;
  }, [reunions, year, month]);

  const sousSecteurCounts = useMemo(() => {
    const counts: Record<SousSecteur, number> = {
      eau: 0,
      gire: 0,
      assainissement: 0,
      inondations: 0,
      transversal: 0,
      reformeInstitutionnelle: 0,
    };
    // Multi-tag : une reunion a plusieurs sous-secteurs compte dans chacun.
    for (const r of reunions) {
      for (const ss of r.sousSecteurs) {
        if (counts[ss] !== undefined) counts[ss]++;
      }
    }
    return counts;
  }, [reunions]);

  const upcoming = useMemo(() => {
    return [...reunions]
      .sort((a, b) => b.dateReunion.localeCompare(a.dateReunion))
      .slice(0, 10);
  }, [reunions]);

  // KPIs dynamiques calculés depuis les données réelles
  const copilStats = useMemo(() => {
    const copils = new Set<string>();
    for (const r of reunions) {
      for (const c of r.copilLies) copils.add(c);
    }
    const list = Array.from(copils);
    return {
      count: list.length,
      delta: list.length > 0 ? list.join(' · ') : 'Aucun COPIL rattaché',
    };
  }, [reunions]);

  const nextReunion = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const future = reunions
      .filter((r) => r.dateReunion >= today)
      .sort((a, b) => a.dateReunion.localeCompare(b.dateReunion));
    return future[0] ?? null;
  }, [reunions]);

  if (reunionsQuery.isLoading) return <Spinner label="Chargement des réunions techniques…" />;
  if (reunionsQuery.error) {
    return (
      <div className="bg-danger-bg border border-danger text-danger rounded-lg px-4 py-3 text-sm">
        Erreur de chargement.
      </div>
    );
  }

  const startWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-3">
        <div>
          <h1 className="text-2xl font-semibold text-fg leading-tight">Suivi Réunions techniques</h1>
          <p className="text-sm text-fg-muted mt-1">
            Activité du MHA · calendrier des réunions, répartition par sous-secteur ·{' '}
            <span className="text-fg-2 font-medium">{anneeLabel}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-fg-muted">
            Année
            <select
              value={annee === null ? TOUTES_ANNEES : String(annee)}
              onChange={(e) =>
                setAnnee(e.target.value === TOUTES_ANNEES ? null : Number(e.target.value))
              }
              className="select block mt-1 font-mono"
            >
              {anneesDisponibles.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
              <option value={TOUTES_ANNEES}>Toutes les années</option>
            </select>
          </label>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/bs/reunion')}>
            <Plus className="w-3.5 h-3.5" /> Nouvelle réunion
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 mb-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Ne compte que les réunions publiées, pour rester cohérent avec le
            badge du menu latéral et les KPI du dashboard SG (tous filtrés
            côté serveur sur visibleSg). La liste ci-dessous, elle, montre en
            plus les brouillons de l'utilisateur courant, signalés comme tels. */}
        <KpiCard
          label="Réunions tenues"
          value={reunions.filter((r) => r.visibleSg).length}
          delta={`publiées · ${anneeLabel} · ${toutesReunions.filter((r) => r.visibleSg).length} au total`}
          icon={Calendar}
        />
        <KpiCard
          label="COPIL réunis"
          value={copilStats.count}
          delta={copilStats.delta}
          icon={FolderKanban}
        />
        <KpiCard
          label="Cette semaine"
          value={countThisWeek(reunions)}
          delta="à 7 jours"
          icon={CalendarClock}
          variant="warning"
        />
        <KpiCard
          label="Prochaine réunion"
          value={nextReunion ? formatShort(nextReunion.dateReunion) : '—'}
          delta={nextReunion ? nextReunion.theme : 'Aucune réunion à venir'}
          icon={CloudRain}
        />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-[1.4fr_1fr] mb-5">
        {/* Calendar */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-md font-semibold">Calendrier · {capitalize(monthLabel)}</h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMonthOffset((o) => o - 1)}
                className="w-8 h-8 rounded border border-border bg-surface hover:bg-muted flex items-center justify-center"
                aria-label="Mois précédent"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setMonthOffset(0)}
                className="text-xs font-mono px-2"
              >
                Aujourd'hui
              </button>
              <button
                type="button"
                onClick={() => setMonthOffset((o) => o + 1)}
                className="w-8 h-8 rounded border border-border bg-surface hover:bg-muted flex items-center justify-center"
                aria-label="Mois suivant"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px bg-border rounded overflow-hidden">
            {DAYS_FR.map((d) => (
              <div key={d} className="bg-surface2 text-center py-2 text-[11px] font-semibold uppercase text-fg-muted tracking-wider">
                {d}
              </div>
            ))}
            {Array.from({ length: startWeekday }).map((_, i) => (
              <div key={`pad-${i}`} className="bg-surface2 min-h-[80px]" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const events = eventsByDay[day] ?? [];
              return (
                <div key={day} className="bg-surface min-h-[80px] p-1.5">
                  <div className="text-[11px] font-mono text-fg-muted">{day}</div>
                  {events.slice(0, 2).map((e, idx) => (
                    <div
                      key={idx}
                      // Une réunion non publiée est un brouillon visible du seul
                      // auteur : elle ne doit pas se confondre avec une réunion
                      // réellement tenue.
                      className={cn(
                        'text-[10.5px] px-1.5 py-0.5 rounded mt-1 truncate',
                        e.visibleSg
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-transparent text-fg-muted border border-dashed border-border italic',
                      )}
                      title={e.visibleSg ? e.theme : `${e.theme} · non publiée`}
                    >
                      {e.theme}
                    </div>
                  ))}
                  {events.length > 2 && (
                    <div className="text-[10.5px] text-fg-muted px-1.5 mt-1">+{events.length - 2}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sous-secteurs */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-md font-semibold">Répartition par sous-secteur</h2>
          </div>
          <div className="card-body space-y-2.5">
            {SOUS_SECTEUR_DEF.map((s) => {
              const value = sousSecteurCounts[s.key];
              const max = Math.max(...Object.values(sousSecteurCounts), 1);
              const pct = (value / max) * 100;
              const Icon = s.icon;
              return (
                <div key={s.key} className="grid grid-cols-[200px_1fr_50px] gap-3 items-center">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" style={{ color: s.color }} /> {s.label}
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                  </div>
                  <div className="font-mono text-sm font-semibold text-right">{value}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Agenda */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-md font-semibold">Agenda · réunions récentes</h2>
          <p className="text-xs text-fg-muted ml-3">{upcoming.length} réunions</p>
          <div className="ml-auto">
            <button className="btn btn-secondary btn-sm">
              <Download className="w-3 h-3" /> Export agenda
            </button>
          </div>
        </div>
        <div className="card-body">
          {upcoming.length === 0 ? (
            <p className="text-sm text-fg-muted text-center py-6">Aucune réunion enregistrée.</p>
          ) : (
            upcoming.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[80px_1fr_auto] gap-3 py-3 border-b border-border last:border-0 items-start"
              >
                <div className="font-mono text-xs text-fg-muted pt-1">{formatShort(r.dateReunion)}</div>
                <div>
                  <div className="text-sm font-medium text-fg">{r.theme}</div>
                  <div className="text-[11.5px] text-fg-muted mt-1 flex items-center gap-2 flex-wrap">
                    {r.sousSecteurs.map((ss) => (
                      <span key={ss} className="badge bg-muted text-fg-2 text-[10.5px]">
                        {SOUS_SECTEUR_DEF.find((s) => s.key === ss)?.label ?? ss}
                      </span>
                    ))}
                    {!r.visibleSg && (
                      <span
                        className="badge bg-warning-bg text-warning text-[10.5px]"
                        title="Réunion créée mais pas encore publiée au SG"
                      >
                        Non publiée
                      </span>
                    )}
                    {r.lieu && <span>· {r.lieu}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  {/* Rouvre la reunion a l'etape 2 du formulaire de saisie : sans
                      ce lien, une reunion creee puis laissee au stade « thème »
                      ne serait plus jamais completable. */}
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => navigate(`/bs/reunion?reunion=${r.id}`)}
                    title="Ouvrir / compléter cette réunion"
                    aria-label={`Ouvrir la réunion ${r.theme}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm text-fg-muted hover:text-danger"
                    type="button"
                    onClick={() => demanderSuppression(r)}
                    title="Supprimer cette réunion"
                    aria-label={`Supprimer la réunion ${r.theme}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(open) => {
          if (!open) setASupprimer(null);
        }}
        title="Supprimer cette réunion ?"
        description={
          aSupprimer
            ? `« ${aSupprimer.theme} » du ${formatShort(aSupprimer.dateReunion)}. Action irréversible.`
            : undefined
        }
        variant="danger"
        confirmLabel="Supprimer"
        onConfirm={confirmerSuppression}
      />
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function countThisWeek(reunions: ReunionTechnique[]): number {
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - 3);
  const end = new Date(now);
  end.setUTCDate(now.getUTCDate() + 4);
  return reunions.filter((r) => {
    const d = new Date(`${r.dateReunion}T00:00:00Z`);
    return d >= start && d <= end;
  }).length;
}
