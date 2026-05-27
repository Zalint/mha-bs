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
import { useMemo, useState } from 'react';
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

const STATE_TABS: { value: StateTab; label: string; icon: LucideIcon }[] = [
  { value: 'tous', label: 'Tous', icon: Inbox },
  { value: 'enCours', label: 'À traiter', icon: Inbox },
  { value: 'attente', label: 'En attente', icon: Clock },
  { value: 'retard', label: 'En retard', icon: AlertTriangle },
  { value: 'realisee', label: 'Clôturées', icon: Archive },
  { value: 'ineligible', label: 'Inéligibles', icon: CheckCircle2 },
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
    secondary: [r.lieu, r.sousSecteur, r.copilLie].filter(Boolean).join(' · ') || null,
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
// Composant
// ---------------------------------------------------------------------------

export function BsListeView() {
  const navigate = useNavigate();
  const today = todayYmd();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('tout');
  const [stateTab, setStateTab] = useState<StateTab>('tous');
  const [search, setSearch] = useState('');

  // Fetch des 4 entités en parallèle (1ère page, large pageSize)
  const directivesQuery = useApi(
    () => api.get<PaginatedResponse<Directive>>('/directives', { query: { pageSize: 500 } }),
    [],
  );
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

  // Filtre état + recherche
  const filtered = useMemo(() => {
    let list = allItems;
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
  }, [allItems, stateTab, search]);

  // Compteurs par état (pour les badges des onglets)
  const stateCounts = useMemo(() => {
    return {
      enCours: allItems.filter((it) => it.etat === 'enCours' || it.etat === null).length,
      attente: allItems.filter((it) => it.etat === 'attente').length,
      retard: allItems.filter((it) => it.retardJours !== null && it.retardJours > 0).length,
      realisee: allItems.filter((it) => it.etat === 'realisee').length,
      ineligible: allItems.filter((it) => it.etat === 'ineligible').length,
    };
  }, [allItems]);

  // Compteurs par type (pour les badges des onglets type)
  const typeCounts = useMemo(() => {
    return {
      directive: directivesQuery.data?.totalCount ?? directivesQuery.data?.items.length ?? 0,
      recommandation: recosQuery.data?.items.length ?? 0,
      reunion: reunionsQuery.data?.items.length ?? 0,
      mission: missionsQuery.data?.items.length ?? 0,
    };
  }, [directivesQuery.data, recosQuery.data, reunionsQuery.data, missionsQuery.data]);

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
        <div className="flex gap-2 relative">
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
          {STATE_TABS.map((t) => {
            const Icon = t.icon;
            const isActive = stateTab === t.value;
            const count =
              t.value === 'tous'
                ? allItems.length
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
