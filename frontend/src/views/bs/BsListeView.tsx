import {
  AlertTriangle,
  Archive,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Filter,
  Inbox,
  Landmark,
  Layers,
  MapPin,
  Plus,
  Search,
  Upload,
} from 'lucide-react';
import { type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type {
  Directive,
  DirectiveEtat,
  MissionTerrain,
  PaginatedResponse,
  RecommandationMatrice,
  ReunionTechnique,
} from '@mha-bs/shared';

import { Spinner } from '../../components/ui/Spinner.js';
import { useApi } from '../../hooks/useApi.js';
import { api } from '../../lib/apiClient.js';
import { cn } from '../../lib/cn.js';
import { daysBetween, formatShort, todayYmd } from '../../lib/formatDate.js';

// ---------------------------------------------------------------------------
// Types unifiés
// ---------------------------------------------------------------------------

type EntityType = 'directive' | 'recommandation' | 'reunion' | 'mission';
type TypeFilter = 'tout' | EntityType;
type StateTab = 'tous' | 'enCours' | 'attente' | 'retard' | 'realisee' | 'ineligible';

interface UnifiedItem {
  id: string;
  type: EntityType;
  code: string;
  libelle: string;
  date: string | null; // échéance ou date événement (YYYY-MM-DD)
  etat: DirectiveEtat | null; // null pour réunions/missions
  retardJours: number | null;
  secondary: string | null; // ministère, projet, sous-secteur, etc.
  detailUrl: string;
}

// ---------------------------------------------------------------------------
// Définitions UI
// ---------------------------------------------------------------------------

const TYPE_DEF: Record<EntityType, { label: string; icon: LucideIcon; color: string }> = {
  directive: { label: 'Directive', icon: Landmark, color: 'bg-success-bg text-success' },
  recommandation: { label: 'Recommandation', icon: ClipboardList, color: 'bg-warning-bg text-warning' },
  reunion: { label: 'Réunion', icon: Calendar, color: 'bg-info-bg text-info' },
  mission: { label: 'Mission', icon: MapPin, color: 'bg-danger-bg text-danger' },
};

const TYPE_TABS: { value: TypeFilter; label: string; icon: LucideIcon }[] = [
  { value: 'tout', label: 'Tout', icon: Layers },
  { value: 'directive', label: 'Directives', icon: Landmark },
  { value: 'recommandation', label: 'Recommandations', icon: ClipboardList },
  { value: 'reunion', label: 'Réunions', icon: Calendar },
  { value: 'mission', label: 'Missions', icon: MapPin },
];

// Defaults statiques utilisés en fallback si la config n'a pas été chargée
const STATE_TABS_DEFAULT: { value: StateTab; label: string; icon: LucideIcon }[] = [
  { value: 'tous', label: 'Tous', icon: Inbox },
  { value: 'enCours', label: 'À traiter', icon: Inbox },
  { value: 'attente', label: 'En attente', icon: Clock },
  { value: 'retard', label: 'En retard', icon: AlertTriangle },
  { value: 'realisee', label: 'Clôturées', icon: Archive },
  { value: 'ineligible', label: 'Inéligibles', icon: CheckCircle2 },
];

// Mapping code → icône (fixe : la logique du filtre est liée au code)
const STATE_TAB_ICONS: Record<StateTab, LucideIcon> = {
  tous: Inbox,
  enCours: Inbox,
  attente: Clock,
  retard: AlertTriangle,
  realisee: Archive,
  ineligible: CheckCircle2,
};

// Codes valides pour les onglets — toute autre valeur en base est ignorée
const VALID_STATE_TAB_CODES: StateTab[] = [
  'tous',
  'enCours',
  'attente',
  'retard',
  'realisee',
  'ineligible',
];

const ETAT_STYLES: Record<DirectiveEtat, string> = {
  attente: 'bg-info-bg text-info',
  enCours: 'bg-warning-bg text-warning',
  realisee: 'bg-success-bg text-success',
  ineligible: 'bg-neutral-bg text-neutral',
};

const ETAT_LABELS: Record<DirectiveEtat, string> = {
  attente: 'En attente',
  enCours: 'En cours',
  realisee: 'Réalisée',
  ineligible: 'Inéligible',
};

// ---------------------------------------------------------------------------
// Adaptateurs entité → UnifiedItem
// ---------------------------------------------------------------------------

function fromDirective(d: Directive, today: string): UnifiedItem {
  const retard = d.echeance && d.echeance < today && d.etat !== 'realisee'
    ? daysBetween(d.echeance, today)
    : null;
  return {
    id: d.id,
    type: 'directive',
    code: d.codeDirective,
    libelle: d.texteDirective,
    date: d.echeance,
    etat: d.etat,
    retardJours: retard,
    secondary: d.ministeresAssocies.length > 0 ? d.ministeresAssocies.join(' · ') : null,
    detailUrl: `/bs/fiche/${d.id}`,
  };
}

function fromRecommandation(r: RecommandationMatrice, _today: string): UnifiedItem {
  return {
    id: r.id,
    type: 'recommandation',
    code: `${r.typeMatrice}-${String(r.numOrdre).padStart(3, '0')}`,
    libelle: r.texteRecommandation,
    date: null, // pas d'échéance ferme (trimestre seulement)
    etat: r.etat,
    retardJours: null,
    secondary: [r.priorite, r.echeanceTrimestre].filter(Boolean).join(' · ') || null,
    detailUrl: '/bs/matrice',
  };
}

function fromReunion(r: ReunionTechnique, _today: string): UnifiedItem {
  return {
    id: r.id,
    type: 'reunion',
    code: `RT-${r.dateReunion}`,
    libelle: r.theme,
    date: r.dateReunion,
    etat: null,
    retardJours: null,
    secondary:
      [r.lieu, ...r.sousSecteurs, ...r.copilLies].filter(Boolean).join(' · ') || null,
    detailUrl: '/reunions-techniques',
  };
}

function fromMission(m: MissionTerrain, _today: string): UnifiedItem {
  return {
    id: m.id,
    type: 'mission',
    code: `MT-${m.dateMission}`,
    libelle: m.localite,
    date: m.dateMission,
    etat: null,
    retardJours: null,
    secondary: [m.region, m.projetRattache].filter(Boolean).join(' · ') || null,
    detailUrl: '/missions-terrain',
  };
}

// ---------------------------------------------------------------------------
// Filtre année (même mécanique que Missions/Réunions)
// ---------------------------------------------------------------------------

const FDT_TOUTES_ANNEES = 'all';
const FDT_ANNEE_STORAGE_KEY = 'mha.filedetravail.annee';

function anneeInitiale(): number | null {
  const courante = new Date().getUTCFullYear();
  if (typeof window === 'undefined') return courante;
  const raw = window.localStorage.getItem(FDT_ANNEE_STORAGE_KEY);
  if (raw === FDT_TOUTES_ANNEES) return null;
  if (!raw) return courante;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : courante;
}

/** Année d'un item (colonne DATE), ou null s'il n'a pas de date. */
function anneeItem(it: UnifiedItem): number | null {
  if (!it.date) return null;
  const y = Number(it.date.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

/**
 * Filtre DOUX : un item passe si l'année n'est pas filtrée, s'il n'a pas de date
 * (toujours visible, cf. décision recommandations), ou si sa date tombe dans
 * l'année choisie.
 */
function passeAnnee(it: UnifiedItem, annee: number | null): boolean {
  if (annee === null) return true;
  const y = anneeItem(it);
  return y === null || y === annee;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function BsListeView() {
  const navigate = useNavigate();
  const today = todayYmd();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('tout');
  const [stateTab, setStateTab] = useState<StateTab>('tous');
  const [search, setSearch] = useState('');

  // === Filtre année ===
  // Année en cours par défaut, mémorisée (même mécanique que Missions/Réunions).
  // Filtre DOUX : une ligne sans date (recommandations, directives sans
  // échéance) reste toujours visible ; seules les lignes datées hors de l'année
  // choisie sont masquées.
  const [annee, setAnnee] = useState<number | null>(anneeInitiale);
  useEffect(() => {
    window.localStorage.setItem(
      FDT_ANNEE_STORAGE_KEY,
      annee === null ? FDT_TOUTES_ANNEES : String(annee),
    );
  }, [annee]);

  // Fetch des 4 entités en parallèle (1ère page, large pageSize)
  const directivesQuery = useApi(
    () => api.get<PaginatedResponse<Directive>>('/directives', { query: { pageSize: 1000 } }),
    [],
  );

  // Onglets dynamiques depuis le référentiel 'fileDeTravailTab'
  const tabsConfigQuery = useApi(
    () =>
      api.get<{ items: { code: string; label: string; ordreAffichage: number; isActive: boolean }[] }>(
        '/referentiels',
        { query: { codeType: 'fileDeTravailTab' } },
      ),
    [],
  );

  const stateTabs = useMemo(() => {
    const items = tabsConfigQuery.data?.items ?? [];
    if (items.length === 0) return STATE_TABS_DEFAULT;
    return items
      .filter((it) => it.isActive && (VALID_STATE_TAB_CODES as string[]).includes(it.code))
      .sort((a, b) => a.ordreAffichage - b.ordreAffichage)
      .map((it) => ({
        value: it.code as StateTab,
        label: it.label,
        icon: STATE_TAB_ICONS[it.code as StateTab] ?? Inbox,
      }));
  }, [tabsConfigQuery.data]);
  const recosQuery = useApi(
    () => api.get<{ items: RecommandationMatrice[] }>('/matrices'),
    [],
  );
  const reunionsQuery = useApi(
    () => api.get<{ items: ReunionTechnique[] }>('/reunions'),
    [],
  );
  const missionsQuery = useApi(
    () => api.get<{ items: MissionTerrain[] }>('/missions'),
    [],
  );

  const isLoading =
    directivesQuery.isLoading ||
    recosQuery.isLoading ||
    reunionsQuery.isLoading ||
    missionsQuery.isLoading;

  // Construit la liste unifiée
  const allItems = useMemo<UnifiedItem[]>(() => {
    const items: UnifiedItem[] = [];
    if (typeFilter === 'tout' || typeFilter === 'directive') {
      for (const d of directivesQuery.data?.items ?? []) {
        items.push(fromDirective(d, today));
      }
    }
    if (typeFilter === 'tout' || typeFilter === 'recommandation') {
      for (const r of recosQuery.data?.items ?? []) {
        items.push(fromRecommandation(r, today));
      }
    }
    if (typeFilter === 'tout' || typeFilter === 'reunion') {
      for (const r of reunionsQuery.data?.items ?? []) {
        items.push(fromReunion(r, today));
      }
    }
    if (typeFilter === 'tout' || typeFilter === 'mission') {
      for (const m of missionsQuery.data?.items ?? []) {
        items.push(fromMission(m, today));
      }
    }
    return items;
  }, [typeFilter, directivesQuery.data, recosQuery.data, reunionsQuery.data, missionsQuery.data, today]);

  // Filtre année (doux) + état + recherche
  const filtered = useMemo(() => {
    let list = allItems.filter((it) => passeAnnee(it, annee));
    if (stateTab !== 'tous') {
      list = list.filter((it) => {
        if (it.etat === null) {
          // Pas d'état → on garde seulement quand 'tous' ou 'enCours' (item en activité)
          return stateTab === 'enCours';
        }
        if (stateTab === 'retard') {
          return it.retardJours !== null && it.retardJours > 0;
        }
        return it.etat === stateTab;
      });
    }
    if (search.trim().length > 0) {
      const s = search.toLowerCase();
      list = list.filter(
        (it) =>
          it.code.toLowerCase().includes(s) ||
          it.libelle.toLowerCase().includes(s) ||
          (it.secondary ?? '').toLowerCase().includes(s),
      );
    }
    // Tri : retard décroissant puis date décroissante
    return [...list].sort((a, b) => {
      if (a.retardJours !== null && b.retardJours !== null) return b.retardJours - a.retardJours;
      if (a.retardJours !== null) return -1;
      if (b.retardJours !== null) return 1;
      const dateA = a.date ?? '';
      const dateB = b.date ?? '';
      return dateB.localeCompare(dateA);
    });
  }, [allItems, annee, stateTab, search]);

  // Compteurs par état — sur l'ensemble filtré par l'année, pour que les badges
  // des onglets d'état correspondent à ce qui est affiché.
  const stateCounts = useMemo(() => {
    const base = allItems.filter((it) => passeAnnee(it, annee));
    return {
      tous: base.length,
      enCours: base.filter((it) => it.etat === 'enCours' || it.etat === null).length,
      attente: base.filter((it) => it.etat === 'attente').length,
      retard: base.filter((it) => it.retardJours !== null && it.retardJours > 0).length,
      realisee: base.filter((it) => it.etat === 'realisee').length,
      ineligible: base.filter((it) => it.etat === 'ineligible').length,
    };
  }, [allItems, annee]);

  // Les quatre entités mappées en UnifiedItem, INDÉPENDAMMENT du filtre de type
  // — sert aux compteurs par type et aux années disponibles.
  const parType = useMemo(
    () => ({
      directive: (directivesQuery.data?.items ?? []).map((d) => fromDirective(d, today)),
      recommandation: (recosQuery.data?.items ?? []).map((r) => fromRecommandation(r, today)),
      reunion: (reunionsQuery.data?.items ?? []).map((r) => fromReunion(r, today)),
      mission: (missionsQuery.data?.items ?? []).map((m) => fromMission(m, today)),
    }),
    [directivesQuery.data, recosQuery.data, reunionsQuery.data, missionsQuery.data, today],
  );

  // Compteurs par type — filtrés par l'année (doux), pour rester cohérents avec
  // la liste et les compteurs d'état.
  const typeCounts = useMemo(
    () => ({
      directive: parType.directive.filter((it) => passeAnnee(it, annee)).length,
      recommandation: parType.recommandation.filter((it) => passeAnnee(it, annee)).length,
      reunion: parType.reunion.filter((it) => passeAnnee(it, annee)).length,
      mission: parType.mission.filter((it) => passeAnnee(it, annee)).length,
    }),
    [parType, annee],
  );

  // Années présentes dans les données (colonne DATE), toutes entités confondues.
  const anneesDisponibles = useMemo(() => {
    const set = new Set<number>();
    for (const liste of Object.values(parType)) {
      for (const it of liste) {
        const y = anneeItem(it);
        if (y !== null) set.add(y);
      }
    }
    set.add(new Date().getUTCFullYear());
    if (annee !== null) set.add(annee);
    return Array.from(set).sort((a, b) => b - a);
  }, [parType, annee]);

  const newItemMenu: { label: string; to: string }[] = [
    { label: 'Nouvelle directive', to: '/bs/fiche' },
    { label: 'Nouvelle recommandation', to: '/bs/recommandation/new' },
    { label: 'Nouvelle réunion / mission', to: '/bs/reunion' },
    { label: 'Nouvelle interpellation', to: '/bs/interpellation/new' },
  ];
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-3">
        <div>
          <h1 className="text-2xl font-semibold text-fg leading-tight">File de travail</h1>
          <p className="text-sm text-fg-muted mt-1">
            Vue unifiée : directives, recommandations, réunions et missions à suivre
          </p>
        </div>
        <div className="flex items-end gap-2 relative">
          <label className="text-xs font-medium text-fg-muted">
            Année
            <select
              value={annee === null ? FDT_TOUTES_ANNEES : String(annee)}
              onChange={(e) =>
                setAnnee(e.target.value === FDT_TOUTES_ANNEES ? null : Number(e.target.value))
              }
              className="select block mt-1 font-mono"
            >
              {anneesDisponibles.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
              <option value={FDT_TOUTES_ANNEES}>Toutes les années</option>
            </select>
          </label>
          <button type="button" className="btn btn-secondary">
            <Filter className="w-3.5 h-3.5" /> Filtres avancés
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/bs/import')}>
            <Upload className="w-3.5 h-3.5" /> Importer
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setNewMenuOpen((v) => !v)}
          >
            <Plus className="w-3.5 h-3.5" /> Nouveau
          </button>
          {newMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg py-1 z-10 min-w-[220px]"
              onMouseLeave={() => setNewMenuOpen(false)}
            >
              {newItemMenu.map((it) => (
                <button
                  key={it.to}
                  type="button"
                  onClick={() => {
                    setNewMenuOpen(false);
                    navigate(it.to);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                >
                  {it.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Type filter */}
      <div className="inline-flex gap-0.5 p-1 bg-muted border border-border rounded-lg mb-3">
        {TYPE_TABS.map((t) => {
          const Icon = t.icon;
          const isActive = typeFilter === t.value;
          const badge =
            t.value === 'tout'
              ? null
              : typeCounts[t.value as EntityType];
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTypeFilter(t.value)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                isActive ? 'bg-surface text-fg shadow-sm' : 'text-fg-2 hover:text-fg',
              )}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.8} /> {t.label}
              {badge !== null && (
                <span
                  className={cn(
                    'text-[11px] px-1.5 py-0.5 rounded-full font-mono',
                    isActive ? 'bg-primary text-white' : 'bg-border text-fg-2',
                  )}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* State tabs + search */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="inline-flex gap-0.5 p-1 bg-muted border border-border rounded-lg">
          {stateTabs.map((t) => {
            const Icon = t.icon;
            const isActive = stateTab === t.value;
            const count =
              t.value === 'tous'
                ? stateCounts.tous
                : t.value === 'enCours'
                  ? stateCounts.enCours
                  : t.value === 'attente'
                    ? stateCounts.attente
                    : t.value === 'retard'
                      ? stateCounts.retard
                      : t.value === 'realisee'
                        ? stateCounts.realisee
                        : stateCounts.ineligible;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setStateTab(t.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  isActive ? 'bg-surface text-fg shadow-sm' : 'text-fg-2 hover:text-fg',
                )}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.8} /> {t.label}
                <span
                  className={cn(
                    'text-[11px] px-1.5 py-0.5 rounded-full font-mono',
                    isActive ? 'bg-primary text-white' : 'bg-border text-fg-2',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (code, libellé, métadonnées)…"
            className="input pl-9 w-[320px]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <Spinner label="Chargement…" />
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="bg-surface2">
                <tr>
                  <th className="text-left px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border w-32">
                    Type
                  </th>
                  <th className="text-left px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border w-32">
                    Code
                  </th>
                  <th className="text-left px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border">
                    Libellé
                  </th>
                  <th className="text-left px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border w-28">
                    Date
                  </th>
                  <th className="text-left px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border w-28">
                    État
                  </th>
                  <th className="text-right px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border w-20">
                    Retard
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-fg-muted py-12 text-sm">
                      <Inbox className="w-8 h-8 mx-auto mb-2 text-fg-muted" strokeWidth={1.5} />
                      Aucun élément dans cette vue.
                    </td>
                  </tr>
                ) : (
                  filtered.map((it) => {
                    const TypeIcon = TYPE_DEF[it.type].icon;
                    const isLate = it.retardJours !== null && it.retardJours > 0;
                    return (
                      <tr
                        key={`${it.type}-${it.id}`}
                        className={cn(
                          'border-b border-border last:border-0 hover:bg-muted cursor-pointer',
                          isLate && 'bg-danger-bg/30',
                        )}
                        onClick={() => navigate(it.detailUrl)}
                      >
                        <td className="px-3 py-3 align-top">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium',
                              TYPE_DEF[it.type].color,
                            )}
                          >
                            <TypeIcon className="w-3 h-3" strokeWidth={2} />
                            {TYPE_DEF[it.type].label}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span className="font-mono text-xs">{it.code}</span>
                        </td>
                        <td className="px-3 py-3 max-w-[480px]">
                          <div className="line-clamp-2 leading-snug">{it.libelle}</div>
                          {it.secondary && (
                            <div className="text-[11.5px] text-fg-muted font-mono mt-1">
                              {it.secondary}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          {it.date ? (
                            <span className="font-mono text-xs">{formatShort(it.date)}</span>
                          ) : (
                            <span className="text-fg-muted text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          {it.etat ? (
                            <span
                              className={cn(
                                'text-xs font-medium px-2.5 py-1 rounded-full',
                                ETAT_STYLES[it.etat],
                              )}
                            >
                              {ETAT_LABELS[it.etat]}
                            </span>
                          ) : (
                            <span className="text-fg-muted text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right align-top">
                          {it.retardJours !== null && it.retardJours > 0 ? (
                            <span className="font-mono text-danger font-semibold">
                              +{it.retardJours} j
                            </span>
                          ) : (
                            <span className="text-fg-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-fg-muted">
        Astuce : clique sur une ligne pour ouvrir le détail. Le filtre <b>Type</b> au-dessus
        permet d&apos;isoler une catégorie ; les onglets d&apos;état filtrent par avancement (les
        réunions et missions n&apos;ont pas d&apos;état — elles sont visibles en mode «&nbsp;Tous&nbsp;»
        et «&nbsp;À traiter&nbsp;»).
      </p>
    </div>
  );
}
