import 'leaflet/dist/leaflet.css';

import type L from 'leaflet';
import {
  CalendarClock,
  ChevronRight,
  Construction,
  Crosshair,
  Globe,
  Layers,
  MapPin,
  Maximize,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type { MissionTerrain } from '@mha-bs/shared';
import { REGIONS_SENEGAL } from '@mha-bs/shared';

import { LocationPickerMap } from '../components/maps/LocationPickerMap.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { KpiCard } from '../components/ui/KpiCard.js';
import { Spinner } from '../components/ui/Spinner.js';
import { useApi } from '../hooks/useApi.js';
import { useReferentiel } from '../hooks/useReferentiel.js';
import { ApiClientError, api } from '../lib/apiClient.js';
import { cn } from '../lib/cn.js';
import { formatShort } from '../lib/formatDate.js';
import {
  FAMILLE_AUCUNE,
  FAMILLE_AUTRE,
  SANS_OUVRAGE,
  couleurFamille,
  ecarterCoincidences,
  famillesDeMission,
  iconeFamilles,
} from '../lib/ouvrageColors.js';
import { useAuthStore } from '../stores/authStore.js';

/**
 * Ouvrage en cours d'edition. Un id est present si la ligne provient deja
 * de la base (charge a l'ouverture du modal) ; sinon c'est une saisie locale
 * qui sera POSTee a la sauvegarde.
 */
interface EditOuvrage {
  id?: string;
  nomOuvrage: string;
  typeOuvrage: string | null;
}

const SENEGAL_BOUNDS: [number, number] = [14.5, -14.5];

/** Valeur sentinelle du <select> pour « toutes les années ». */
const TOUTES_ANNEES = 'all';

/**
 * Le filtre année est mémorisé, comme celui du Dashboard global
 * (`mha.dashboard.annee`) — deux écrans du même produit qui se comporteraient
 * différemment seraient plus déroutants que la mémorisation elle-même.
 * En l'absence de valeur stockée, on ouvre sur l'année en cours.
 */
const ANNEE_STORAGE_KEY = 'mha.missions.annee';

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
 * Année d'une mission, extraite de `dateMission` au format YYYY-MM-DD.
 * Découpage de chaîne et non `new Date()` : une date sans heure est interprétée
 * en UTC par le moteur JS, et un `getFullYear()` local ferait basculer le
 * 1er janvier sur l'année précédente pour les fuseaux à l'ouest de Greenwich.
 */
function anneeMission(m: MissionTerrain): number | null {
  if (!m.dateMission) return null;
  const y = Number(m.dateMission.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}
/**
 * Brouillon de mission en cours d'édition. On extrait les champs éditables et
 * on garde l'id en clé pour la requête PUT. Tous les champs nullable côté DB
 * sont en string vide ici pour simplifier le binding form.
 */
interface MissionDraft {
  id: string;
  dateMission: string;
  localite: string;
  region: string; // '' = null
  latitude: number | null;
  longitude: number | null;
  projetRattache: string; // '' = null
  constats: string; // '' = null
  recommandations: string; // '' = null
}

function missionToDraft(m: MissionTerrain): MissionDraft {
  return {
    id: m.id,
    dateMission: m.dateMission,
    localite: m.localite,
    region: m.region ?? '',
    latitude: m.latitude,
    longitude: m.longitude,
    projetRattache: m.projetRattache ?? '',
    constats: m.constats ?? '',
    recommandations: m.recommandations ?? '',
  };
}

/**
 * Remonte l'instance de carte ET le zoom courant au parent. Doit vivre DANS le
 * MapContainer : `useMapEvents` lit la carte par le contexte react-leaflet.
 *
 * L'instance passe par un STATE et non par le `ref` du MapContainer : le calcul
 * d'ecartement des marqueurs a besoin de la projection, et un ref n'etant pas
 * reactif, le memo s'executait une fois avec `null` puis plus jamais — les
 * marqueurs restaient empiles. Mesure avant/apres : 33 marqueurs pour 18
 * positions distinctes, puis 33 sur 33.
 */
function SuiviCarte({ onCarte }: { onCarte: (carte: L.Map, zoom: number) => void }) {
  const carte = useMapEvents({
    zoomend: () => onCarte(carte, carte.getZoom()),
  });
  useEffect(() => {
    onCarte(carte, carte.getZoom());
  }, [carte, onCarte]);
  return null;
}

export function MissionsTerrainView() {
  const navigate = useNavigate();
  const userRole = useAuthStore((s) => s.user?.role);
  const canEdit = userRole === 'admin' || userRole === 'bs';
  // canDelete = canEdit ici — admin ET bs peuvent supprimer (unitaire et bulk).
  // On garde isAdmin pour les actions vraiment reservees a l'admin (wipe DB,
  // backfill geocoding...) si besoin futur.
  const canDelete = canEdit;

  const query = useApi(() => api.get<{ items: MissionTerrain[] }>('/missions'), []);
  const toutesMissions = useMemo(() => query.data?.items ?? [], [query.data]);

  // === Filtre année ===
  // Année mémorisée, sinon l'année en cours. Pas de bascule automatique vers la
  // dernière année remplie : elle ferait mentir le libellé affiché.
  const [annee, setAnnee] = useState<number | null>(anneeInitiale);
  useEffect(() => {
    window.localStorage.setItem(ANNEE_STORAGE_KEY, annee === null ? TOUTES_ANNEES : String(annee));
  }, [annee]);

  const anneesDisponibles = useMemo(() => {
    const set = new Set<number>();
    for (const m of toutesMissions) {
      const y = anneeMission(m);
      if (y !== null) set.add(y);
    }
    // L'année en cours et l'année sélectionnée restent toujours proposées,
    // sinon on ne pourrait plus revenir sur une année devenue vide.
    set.add(new Date().getUTCFullYear());
    if (annee !== null) set.add(annee);
    return Array.from(set).sort((a, b) => b - a);
  }, [toutesMissions, annee]);

  const missionsAnnee = useMemo(
    () => (annee === null ? toutesMissions : toutesMissions.filter((m) => anneeMission(m) === annee)),
    [toutesMissions, annee],
  );

  // === Filtre par type d'ouvrage ===
  // Ensemble VIDE = aucun filtre (tout est affiché), et non « rien n'est
  // affiché » : c'est l'état d'ouverture, il doit tout montrer.
  // La valeur sentinelle SANS_OUVRAGE cible les missions sans ouvrage saisi,
  // sinon elles seraient impossibles à isoler — or elles sont majoritaires.
  const [typesSelectionnes, setTypesSelectionnes] = useState<Set<string>>(new Set());
  const basculerType = (code: string): void => {
    setTypesSelectionnes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  /** Applique le filtre par type a n'importe quel ensemble de missions. */
  const filtrerParType = useCallback(
    (missions: MissionTerrain[]): MissionTerrain[] => {
      if (typesSelectionnes.size === 0) return missions;
      return missions.filter((m) => {
        const types = Object.keys(m.ouvragesParType);
        return types.length === 0
          ? typesSelectionnes.has(SANS_OUVRAGE)
          : types.some((t) => typesSelectionnes.has(t));
      });
    },
    [typesSelectionnes],
  );

  const items = useMemo(() => filtrerParType(missionsAnnee), [missionsAnnee, filtrerParType]);

  /**
   * Toutes annees confondues, MAIS filtre par type — c'est la reference des
   * sous-titres de KPI. Utiliser `toutesMissions` y afficherait « 41 au total »
   * sous un chiffre filtre, exactement le genre de contradiction qui a deja ete
   * signalee sur le badge du menu.
   */
  const missionsType = useMemo(() => filtrerParType(toutesMissions), [toutesMissions, filtrerParType]);

  const anneeLabel = annee === null ? 'toutes années' : `année ${annee}`;

  // Referentiel type d'ouvrage : sert a afficher le libelle propre + alimenter
  // le dropdown du form 'Ajouter un ouvrage' dans le modal d'edition.
  const typeOuvrageRef = useReferentiel('typeOuvrage');

  const mapRef = useRef<L.Map | null>(null);
  // Carte + zoom courants, remontes par SuiviCarte. L'ecartement des marqueurs
  // co-localises se calcule en PIXELS : il faut donc la projection et le zoom.
  const [carte, setCarte] = useState<L.Map | null>(null);
  const [zoomCarte, setZoomCarte] = useState(7);
  // Identite stable : passe en dependance de l'effet de SuiviCarte.
  const majCarte = useCallback((instance: L.Map, zoom: number): void => {
    mapRef.current = instance;
    setCarte(instance);
    setZoomCarte(zoom);
  }, []);

  // Édition : draft de mission + modal picker carte
  const [editDraft, setEditDraft] = useState<MissionDraft | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Ouvrages associes a la mission en cours d'edition. Liste melangee :
  //   - lignes avec `id`  → ouvrages existants charges depuis l'API
  //   - lignes sans `id`  → ouvrages saisis localement (POST au save)
  // `deletedOuvrageIds` retient les ids d'existants supprimes par l'user pour
  // les DELETE lors du save.
  const [editOuvrages, setEditOuvrages] = useState<EditOuvrage[]>([]);
  const [deletedOuvrageIds, setDeletedOuvrageIds] = useState<Set<string>>(new Set());

  // === Sélection multiple pour bulk delete ===
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Sélection RESTREINTE aux missions visibles : sans ça, cocher « tout » sur
  // 2026 puis basculer sur 2025 enverrait au bulk-delete des ids que l'écran
  // n'affiche plus. On garde la sélection en mémoire (revenir sur l'année la
  // retrouve) mais on n'agit jamais au-delà de ce qui est à l'écran.
  const selectedVisibles = useMemo(
    () => items.filter((m) => selectedIds.has(m.id)).map((m) => m.id),
    [items, selectedIds],
  );
  const allSelected = items.length > 0 && items.every((m) => selectedIds.has(m.id));
  const toggleAll = (): void => {
    const next = new Set(selectedIds);
    // Ne touche qu'aux lignes de l'année affichée.
    if (allSelected) items.forEach((m) => next.delete(m.id));
    else items.forEach((m) => next.add(m.id));
    setSelectedIds(next);
  };
  const toggleOne = (id: string): void => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const startEdit = (m: MissionTerrain): void => {
    setEditDraft(missionToDraft(m));
    // Reset ouvrages avant le fetch pour eviter un flash de l'ancienne liste
    setEditOuvrages([]);
    setDeletedOuvrageIds(new Set());
    // Charge les ouvrages existants. GET /missions/:id renvoie { ...mission, ouvrages }.
    void (async () => {
      try {
        const res = await api.get<{ ouvrages?: Array<EditOuvrage> }>(`/missions/${m.id}`);
        setEditOuvrages(
          (res.ouvrages ?? []).map((o) => ({
            id: o.id,
            nomOuvrage: o.nomOuvrage,
            typeOuvrage: o.typeOuvrage,
          })),
        );
      } catch {
        // silencieux — la mission a juste pas d'ouvrages, ou erreur reseau
      }
    })();
  };
  const cancelEdit = (): void => {
    setEditDraft(null);
    setShowPicker(false);
    setEditOuvrages([]);
    setDeletedOuvrageIds(new Set());
  };

  /** Push d'un ouvrage nouvellement saisi dans le modal. */
  const addEditOuvrage = (o: EditOuvrage): void => {
    setEditOuvrages((arr) => [...arr, { ...o, id: undefined }]);
  };

  /**
   * Retire un ouvrage de la liste editable. S'il existait deja en DB (id !=
   * undefined), on marque son id pour DELETE au save. Sinon (ouvrage local
   * jamais POSTe), il suffit de l'oublier.
   */
  const removeEditOuvrage = (index: number): void => {
    const target = editOuvrages[index];
    if (!target) return;
    if (target.id) {
      setDeletedOuvrageIds((s) => {
        const next = new Set(s);
        next.add(target.id!);
        return next;
      });
    }
    setEditOuvrages((arr) => arr.filter((_, i) => i !== index));
  };

  const saveEdit = async (): Promise<void> => {
    if (!editDraft) return;
    setSaving(true);
    try {
      // 1) Update champs principaux de la mission
      await api.put(`/missions/${editDraft.id}`, {
        dateMission: editDraft.dateMission,
        localite: editDraft.localite,
        region: editDraft.region || null,
        latitude: editDraft.latitude,
        longitude: editDraft.longitude,
        projetRattache: editDraft.projetRattache || null,
        constats: editDraft.constats || null,
        recommandations: editDraft.recommandations || null,
      });

      // 2) Sync ouvrages : DELETE les supprimes, POST les nouveaux
      //    (sequentiel pour eviter un burst de requetes ; volume tres faible
      //    en pratique — quelques ouvrages max par mission)
      for (const id of deletedOuvrageIds) {
        await api.delete(`/missions/ouvrages/${id}`);
      }
      for (const o of editOuvrages.filter((x) => !x.id)) {
        await api.post(`/missions/${editDraft.id}/ouvrages`, {
          nomOuvrage: o.nomOuvrage,
          typeOuvrage: o.typeOuvrage,
          etatOuvrage: 'fonctionnel', // valeur silencieuse — cf decision UI
        });
      }

      toast.success('Mission mise à jour');
      setEditDraft(null);
      setEditOuvrages([]);
      setDeletedOuvrageIds(new Set());
      query.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur de mise à jour');
    } finally {
      setSaving(false);
    }
  };

  // === Confirm dialog (remplace window.confirm) ===
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description?: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const deleteMission = (m: MissionTerrain): void => {
    setConfirmState({
      title: 'Supprimer cette mission ?',
      description: `Mission du ${formatShort(m.dateMission)} à ${m.localite}${m.projetRattache ? ` (${m.projetRattache})` : ''}. Action irréversible.`,
      onConfirm: async () => {
        try {
          await api.delete(`/missions/${m.id}`);
          toast.success('Mission supprimée');
          query.refetch();
        } catch (err) {
          toast.error(err instanceof ApiClientError ? err.message : 'Erreur de suppression');
        }
      },
    });
  };

  const bulkDelete = (): void => {
    if (selectedVisibles.length === 0) return;
    setConfirmState({
      title: `Supprimer ${selectedVisibles.length} mission(s) ?`,
      description: `Les missions sélectionnées (${anneeLabel}) seront définitivement supprimées avec leurs ouvrages associés. Action irréversible.`,
      onConfirm: async () => {
        try {
          const res = await api.post<{ deleted: number }>('/missions/bulk-delete', {
            ids: selectedVisibles,
          });
          toast.success(`${res.deleted} mission(s) supprimée(s)`);
          setSelectedIds(new Set());
          query.refetch();
        } catch (err) {
          toast.error(err instanceof ApiClientError ? err.message : 'Erreur de suppression');
        }
      },
    });
  };

  const regions = useMemo(() => {
    return new Set(items.map((i) => i.region).filter(Boolean));
  }, [items]);

  /**
   * Famille d'un type d'ouvrage, lue dans le referentiel (`parentCode`).
   * Un type sans rattachement — ou un code absent du referentiel, par exemple
   * apres renommage dans /bs/config — retombe sur « autre » plutot que de
   * disparaitre de la carte.
   */
  const familleDeType = useCallback(
    (code: string): string => typeOuvrageRef.parentDe(code) ?? FAMILLE_AUTRE,
    [typeOuvrageRef],
  );

  /**
   * Puces du bandeau sous la carte : elles servent A LA FOIS de legende (pastille
   * de couleur -> famille) et de filtre (clic = facette). Un seul controle plutot
   * que deux : la legende seule n'expliquerait pas pourquoi deux types partagent
   * une couleur, et un filtre seul n'expliquerait pas les couleurs.
   *
   * Construites sur les types PRESENTS dans l'annee affichee, pas sur les 7 du
   * referentiel : proposer de filtrer sur un type absent de la carte ne mene
   * qu'a un ecran vide.
   */
  const pucesTypes = useMemo(() => {
    const compteurs = new Map<string, number>();
    let sansOuvrage = 0;
    for (const m of missionsAnnee) {
      // Compte des OUVRAGES et non des missions : meme unite que la carte
      // « Sites visités », pour que les deux chiffres se répondent.
      const entrees = Object.entries(m.ouvragesParType);
      if (entrees.length === 0) sansOuvrage++;
      else for (const [t, n] of entrees) compteurs.set(t, (compteurs.get(t) ?? 0) + n);
    }
    // On part des codes OBSERVES, pas du referentiel : un type renomme ou
    // desactive dans /bs/config laisse des lignes en base avec l'ancien code.
    // Iterer le referentiel les rendait invisibles — sans puce, hors des
    // comptes, impossibles a isoler — alors que leurs marqueurs, eux,
    // s'affichaient. Le referentiel ne sert plus qu'a habiller (libelle,
    // ordre), et `labelDe` retombe sur le code brut s'il ne connait pas.
    const rang = new Map(typeOuvrageRef.items.map((t, i) => [t.code, i]));
    const puces = [...compteurs.entries()]
      .sort(([a], [b]) => (rang.get(a) ?? Infinity) - (rang.get(b) ?? Infinity))
      .map(([code, n]) => ({
        code,
        label: typeOuvrageRef.labelDe(code),
        couleur: couleurFamille(familleDeType(code)),
        n,
      }));
    if (sansOuvrage > 0) {
      puces.push({
        code: SANS_OUVRAGE,
        label: 'Aucun ouvrage saisi',
        couleur: couleurFamille(FAMILLE_AUCUNE),
        n: sansOuvrage,
      });
    }
    return puces;
  }, [missionsAnnee, typeOuvrageRef, familleDeType]);

  // Vrai total d'ouvrages visités, via le sous-total `nbOuvrages` calculé par
  // l'API. Auparavant cette carte affichait le nombre de MISSIONS, donc le même
  // chiffre que « Missions effectuées » juste à côté, sous un libellé
  // « ouvrages d'envergure » qui ne correspondait à rien.
  /**
   * Somme des ouvrages affiches. Quand un filtre par type est actif, on ne
   * compte QUE les ouvrages de ces types : sinon une mission qui a un bassin et
   * une station de pompage ferait afficher 2 alors que le filtre ne porte que
   * sur le bassin. `nbOuvrages` reste le total de la mission, il ne convient
   * donc que hors filtre.
   */
  const totalOuvrages = useMemo(() => {
    if (typesSelectionnes.size === 0) return items.reduce((n, m) => n + m.nbOuvrages, 0);
    return items.reduce(
      (n, m) =>
        n +
        Object.entries(m.ouvragesParType).reduce(
          (s, [type, compte]) => (typesSelectionnes.has(type) ? s + compte : s),
          0,
        ),
      0,
    );
  }, [items, typesSelectionnes]);

  const missionsSansOuvrage = useMemo(
    () => items.filter((m) => m.nbOuvrages === 0).length,
    [items],
  );

  /**
   * Missions geolocalisees, positions ecartees quand plusieurs partagent le
   * meme point. Sans cet ecartement, les cinq missions 2026 — toutes en region
   * de Dakar — se superposent au pixel pres et seule la couleur du dernier
   * marqueur rendu est lisible : le codage couleur ne sert plus a rien
   * precisement la ou il y a le plus de missions.
   */
  const marqueurs = useMemo(() => {
    // L'ecart est calcule a la projection du zoom COURANT : `zoomCarte` est dans
    // les dependances pour que l'eventail se resserre quand on zoome et ne
    // devienne pas une constellation trompeuse.
    const projection =
      carte !== null
        ? {
            versPixels: (lat: number, lng: number) => carte.project([lat, lng], zoomCarte),
            versLatLng: (x: number, y: number) => carte.unproject([x, y], zoomCarte),
          }
        : null;
    return ecarterCoincidences(
      items
        .filter((m) => m.latitude !== null && m.longitude !== null)
        .map((m) => ({ ...m, latitude: m.latitude as number, longitude: m.longitude as number })),
      projection,
    );
  }, [items, carte, zoomCarte]);

  /** « 2026 : 12 · 2025 : 20 · 2024 : 11 » — affiché en mode « toutes années ». */
  const repartitionParAnnee = useMemo(() => {
    const parAnnee = new Map<number, number>();
    // `missionsType` et non `toutesMissions` : la ventilation doit se sommer au
    // chiffre affiche juste au-dessus, filtre par type compris.
    for (const m of missionsType) {
      const y = anneeMission(m);
      if (y !== null) parAnnee.set(y, (parAnnee.get(y) ?? 0) + 1);
    }
    return Array.from(parAnnee.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([y, n]) => `${y} : ${n}`)
      .join(' · ');
  }, [missionsType]);

  /**
   * Prochaine mission a venir dans la periode affichee ; a defaut, la plus
   * recente deja passee. Remplace une date en dur (« 21-05-2026 ») qui restait
   * du maquettage et ne bougeait jamais avec les donnees.
   */
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const prochaineMission = useMemo(
    () =>
      items
        .filter((m) => m.dateMission && m.dateMission >= aujourdhui)
        .sort((a, b) => a.dateMission.localeCompare(b.dateMission))[0] ?? null,
    [items, aujourdhui],
  );
  const derniereMission = useMemo(
    () =>
      items
        .filter((m) => m.dateMission)
        .sort((a, b) => b.dateMission.localeCompare(a.dateMission))[0] ?? null,
    [items],
  );
  const reperMission = prochaineMission ?? derniereMission;

  if (query.isLoading) return <Spinner label="Chargement des missions terrain…" />;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-3">
        <div>
          <h1 className="text-2xl font-semibold text-fg leading-tight">Suivi missions terrain</h1>
          <p className="text-sm text-fg-muted mt-1">
            Sites d'ouvrages visités par le MHA · cartographie nationale et observations ·{' '}
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
          {canDelete && selectedVisibles.length > 0 && (
            <button
              type="button"
              onClick={bulkDelete}
              className="btn bg-danger text-white hover:bg-danger/90"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer ({selectedVisibles.length})
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => navigate('/bs/reunion')}>
            <Plus className="w-3.5 h-3.5" /> Nouvelle mission
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 mb-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Missions effectuées"
          value={items.length}
          delta={
            annee === null
              ? `toutes années · ${repartitionParAnnee}`
              : `${anneeLabel} · ${missionsType.length} au total`
          }
          icon={MapPin}
        />
        <KpiCard
          label="Sites visités"
          value={totalOuvrages}
          delta={
            missionsSansOuvrage === 0
              ? "ouvrages d'envergure"
              : `ouvrages · ${missionsSansOuvrage} mission(s) sans ouvrage saisi`
          }
          icon={Construction}
        />
        <KpiCard
          label="Régions couvertes"
          value={regions.size}
          delta={Array.from(regions).slice(0, 3).join(' · ') || 'aucune région renseignée'}
          icon={Globe}
        />
        <KpiCard
          label={prochaineMission ? 'Prochaine mission' : 'Dernière mission'}
          value={reperMission ? formatShort(reperMission.dateMission) : '—'}
          delta={
            reperMission
              ? [reperMission.projetRattache, reperMission.localite].filter(Boolean).join(' · ')
              : `aucune mission en ${anneeLabel}`
          }
          icon={CalendarClock}
        />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-[1.6fr_1fr]">
        {/* Carte */}
        <div className="card overflow-hidden">
          <div className="card-header">
            <div>
              <h2 className="text-md font-semibold">Carte nationale des missions</h2>
              <p className="text-xs text-fg-muted mt-0.5">Cliquez sur un marqueur pour voir le détail.</p>
            </div>
            <div className="ml-auto flex gap-2">
              <button className="btn btn-ghost btn-sm">
                <Layers className="w-3 h-3" /> Couches
              </button>
              <button className="btn btn-ghost btn-sm">
                <Maximize className="w-3 h-3" /> Plein écran
              </button>
            </div>
          </div>
          <div style={{ height: 520 }}>
            <MapContainer
              center={SENEGAL_BOUNDS}
              zoom={7}
              scrollWheelZoom
              style={{ height: '100%', width: '100%' }}
              ref={(map) => {
                if (map) mapRef.current = map;
              }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <SuiviCarte onCarte={majCarte} />
              {marqueurs.map((m) => (
                  <Marker
                    key={m.id}
                    position={m.position}
                    icon={iconeFamilles(
                      famillesDeMission(Object.keys(m.ouvragesParType), familleDeType),
                    )}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'Fira Sans, system-ui, sans-serif' }}>
                        <b style={{ color: '#0284C7' }}>{m.localite}</b>
                        <br />
                        <span style={{ color: '#64748B' }}>{m.projetRattache ?? '—'}</span>
                        <br />
                        <span style={{ fontFamily: 'Fira Mono, monospace', fontSize: 11 }}>
                          {m.dateMission ? formatShort(m.dateMission) : '—'} · {m.region ?? '—'}
                        </span>
                        {/* Le TYPE PRECIS est rappele ici : la couleur ne porte
                            que la famille, elle ne doit jamais etre le seul
                            vecteur de l'information. */}
                        <br />
                        {Object.keys(m.ouvragesParType).length === 0 ? (
                          <span style={{ color: '#94A3B8', fontSize: 11, fontStyle: 'italic' }}>
                            Aucun ouvrage saisi
                          </span>
                        ) : (
                          Object.entries(m.ouvragesParType).map(([code, compte]) => (
                            <span
                              key={code}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                marginRight: 6,
                                fontSize: 11,
                              }}
                            >
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  background: couleurFamille(familleDeType(code)),
                                  display: 'inline-block',
                                }}
                              />
                              {typeOuvrageRef.labelDe(code)}
                              {compte > 1 && <b>&nbsp;×{compte}</b>}
                            </span>
                          ))
                        )}
                        {m.constats && (
                          <>
                            <br />
                            {m.constats.slice(0, 110)}
                          </>
                        )}
                      </div>
                    </Popup>
                  </Marker>
              ))}
            </MapContainer>
          </div>

          {/* Legende ET filtre. Deux types de la meme famille partagent une
              couleur : c'est visible ici, puce contre puce. */}
          {pucesTypes.length > 0 && (
            <div className="px-4 py-3 border-t border-border">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-fg-muted mr-1">
                  Type d’ouvrage
                </span>
                {pucesTypes.map((p) => {
                  const actif = typesSelectionnes.has(p.code);
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => basculerType(p.code)}
                      aria-pressed={actif}
                      // Le filtre est ADDITIF (OU) : un 2e clic elargit la
                      // selection. L'ancien libelle « N'afficher que X »
                      // promettait l'inverse.
                      title={
                        actif
                          ? `Retirer « ${p.label} » du filtre`
                          : `Ajouter « ${p.label} » au filtre`
                      }
                      className={cn(
                        'inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full border text-[11.5px] transition-colors',
                        actif
                          ? 'border-primary bg-primary-100 text-primary-700 font-medium'
                          : 'border-border bg-surface text-fg-2 hover:bg-muted',
                      )}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-white flex-shrink-0"
                        style={{ background: p.couleur, boxShadow: '0 0 0 1px rgba(0,0,0,.12)' }}
                      />
                      {p.label}
                      <span className="font-mono tabular-nums text-fg-muted">{p.n}</span>
                    </button>
                  );
                })}
                {typesSelectionnes.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setTypesSelectionnes(new Set())}
                    className="text-[11.5px] text-primary hover:underline ml-1"
                  >
                    Tout afficher
                  </button>
                )}
              </div>
              <p className="text-[11px] text-fg-muted mt-2">
                Une même couleur = une même famille d’ouvrage. Un marqueur bicolore signale
                une mission qui en a visité plusieurs.
              </p>
            </div>
          )}
        </div>

        {/* Liste */}
        <div className="card overflow-hidden">
          <div className="card-header gap-2">
            {canDelete && items.length > 0 && (
              <input
                type="checkbox"
                aria-label="Tout sélectionner"
                checked={allSelected}
                onChange={toggleAll}
                className="accent-primary"
              />
            )}
            <h2 className="text-md font-semibold">Sites visités</h2>
            <span className="ml-auto text-sm text-fg-muted">
              {selectedVisibles.length > 0 ? `${selectedVisibles.length} / ` : ''}
              {items.length} site(s) · {anneeLabel}
            </span>
          </div>
          <div className="max-h-[520px] overflow-auto">
            {items.length === 0 ? (
              <div className="text-center py-10 px-4">
                {/* Deux filtres peuvent vider la liste. On nomme CELUI qui l'a
                    fait, sinon on propose d'elargir l'annee alors que c'est le
                    filtre par type d'ouvrage qui est en cause. */}
                <p className="text-sm text-fg-muted">
                  {toutesMissions.length === 0
                    ? 'Aucune mission enregistrée.'
                    : typesSelectionnes.size > 0
                      ? `Aucune mission de ce type d’ouvrage en ${anneeLabel}.`
                      : `Aucune mission en ${anneeLabel}.`}
                </p>
                {typesSelectionnes.size > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTypesSelectionnes(new Set())}
                    className="btn btn-ghost btn-sm mt-2"
                  >
                    Retirer le filtre par type ({missionsAnnee.length} mission(s))
                  </button>
                ) : (
                  toutesMissions.length > 0 &&
                  annee !== null && (
                    <button
                      type="button"
                      onClick={() => setAnnee(null)}
                      className="btn btn-ghost btn-sm mt-2"
                    >
                      Voir toutes les années ({toutesMissions.length})
                    </button>
                  )
                )}
              </div>
            ) : (
              items.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    canDelete
                      ? 'grid grid-cols-[24px_36px_1fr_auto] gap-3 px-4 py-3 border-b border-border'
                      : 'grid grid-cols-[36px_1fr_auto] gap-3 px-4 py-3 border-b border-border',
                    'last:border-0 hover:bg-muted items-center',
                    selectedIds.has(m.id) && 'bg-primary-100/30',
                  )}
                >
                  {canDelete && (
                    <input
                      type="checkbox"
                      aria-label={`Sélectionner mission ${m.localite}`}
                      checked={selectedIds.has(m.id)}
                      onChange={() => toggleOne(m.id)}
                      className="accent-primary"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (mapRef.current && m.latitude !== null && m.longitude !== null) {
                        mapRef.current.setView([m.latitude, m.longitude], 13, { animate: true });
                      }
                    }}
                    className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-mono font-semibold text-[11px] hover:opacity-80"
                    aria-label="Centrer sur la carte"
                    title={
                      m.latitude !== null
                        ? 'Centrer sur la carte'
                        : 'Coordonnées non renseignées'
                    }
                  >
                    {m.localite.slice(0, 2).toUpperCase()}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (mapRef.current && m.latitude !== null && m.longitude !== null) {
                        mapRef.current.setView([m.latitude, m.longitude], 13, { animate: true });
                      }
                    }}
                    className="text-left min-w-0"
                  >
                    <div className="text-sm font-semibold truncate">{m.localite}</div>
                    <div className="text-[11.5px] text-fg-muted font-mono">
                      {m.projetRattache ?? '—'} · {m.region ?? '—'} ·{' '}
                      {m.dateMission ? formatShort(m.dateMission) : '—'}
                    </div>
                    {m.constats && (
                      <div className="text-xs text-fg-2 mt-1 line-clamp-1">{m.constats}</div>
                    )}
                  </button>
                  {canEdit ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(m)}
                        className="text-fg-muted hover:text-primary p-1.5 rounded"
                        aria-label="Éditer"
                        title="Éditer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => deleteMission(m)}
                          className="text-fg-muted hover:text-danger p-1.5 rounded"
                          aria-label="Supprimer"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-fg-muted" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {toutesMissions.length === 0 && (
        <p className="mt-3 text-xs text-fg-muted italic">
          Aucune mission terrain en base. Crée une nouvelle mission via le bouton ci-dessus.
        </p>
      )}

      {/* Modal d'édition */}
      {editDraft && (
        <MissionEditModal
          draft={editDraft}
          onChange={setEditDraft}
          onCancel={cancelEdit}
          onSave={() => void saveEdit()}
          onOpenPicker={() => setShowPicker(true)}
          saving={saving}
          ouvrages={editOuvrages}
          onAddOuvrage={addEditOuvrage}
          onRemoveOuvrage={removeEditOuvrage}
          typesOuvrage={typeOuvrageRef.items.map((t) => ({
            code: t.code,
            label: t.label,
          }))}
        />
      )}

      {/* Modal picker carte (au-dessus du modal d'édition) */}
      {showPicker && editDraft && (
        <LocationPickerMap
          value={
            editDraft.latitude !== null && editDraft.longitude !== null
              ? { latitude: editDraft.latitude, longitude: editDraft.longitude }
              : null
          }
          title={`Localisation de ${editDraft.localite || 'la mission'}`}
          onCancel={() => setShowPicker(false)}
          onConfirm={(coords) => {
            setEditDraft({
              ...editDraft,
              latitude: coords?.latitude ?? null,
              longitude: coords?.longitude ?? null,
            });
            setShowPicker(false);
          }}
        />
      )}

      {/* Dialogue de confirmation pour la suppression d'une mission */}
      <ConfirmDialog
        open={confirmState !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmState(null);
        }}
        title={confirmState?.title ?? ''}
        description={confirmState?.description}
        variant="danger"
        confirmLabel="Supprimer"
        onConfirm={async () => {
          if (confirmState) await confirmState.onConfirm();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal d'édition d'une mission — formulaire + bouton "Choisir sur la carte"
// ---------------------------------------------------------------------------

interface MissionEditModalProps {
  draft: MissionDraft;
  onChange: (next: MissionDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  onOpenPicker: () => void;
  saving: boolean;
  ouvrages: EditOuvrage[];
  onAddOuvrage: (o: EditOuvrage) => void;
  onRemoveOuvrage: (index: number) => void;
  typesOuvrage: { code: string; label: string }[];
}

function MissionEditModal({
  draft,
  onChange,
  onCancel,
  onSave,
  onOpenPicker,
  saving,
  ouvrages,
  onAddOuvrage,
  onRemoveOuvrage,
  typesOuvrage,
}: MissionEditModalProps) {
  const set = <K extends keyof MissionDraft>(k: K, v: MissionDraft[K]): void => {
    onChange({ ...draft, [k]: v });
  };

  // Form local pour la saisie d'un nouvel ouvrage dans le modal d'edition
  const [newNom, setNewNom] = useState('');
  const [newType, setNewType] = useState('');
  const handleAddOuvrage = (): void => {
    const trimmed = newNom.trim();
    if (!trimmed) return;
    onAddOuvrage({ nomOuvrage: trimmed, typeOuvrage: newType || null });
    setNewNom('');
    setNewType('');
  };

  return (
    <div
      // z-[1000] — au-dessus des panes/controls Leaflet (qui montent jusqu'à 800).
      // Le picker carte (autre modal) doit etre encore au-dessus (cf. z-[1100]).
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-xl shadow-2xl border border-border w-full max-w-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface2">
          <h2 className="text-md font-semibold flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />
            Éditer la mission
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-fg-muted hover:text-fg p-1 rounded"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date de mission" required>
              <input
                type="date"
                value={draft.dateMission}
                onChange={(e) => set('dateMission', e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Région">
              <select
                value={draft.region}
                onChange={(e) => set('region', e.target.value)}
                className="input"
              >
                <option value="">— Aucune —</option>
                {REGIONS_SENEGAL.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Localité" required>
            <input
              type="text"
              value={draft.localite}
              onChange={(e) => set('localite', e.target.value)}
              className="input"
              placeholder="ex. Touba, Tivaouane Peulh…"
            />
          </Field>

          <Field label="Projet rattaché">
            <input
              type="text"
              value={draft.projetRattache}
              onChange={(e) => set('projetRattache', e.target.value)}
              className="input"
              placeholder="ex. PROGEP II, ONAS, PISEA…"
            />
          </Field>

          {/* Localisation : coords + bouton carte */}
          <div className="border border-border rounded-lg p-3 bg-surface2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">
                Coordonnées GPS
              </span>
              <button
                type="button"
                onClick={onOpenPicker}
                className="btn btn-secondary btn-sm"
              >
                <Crosshair className="w-3.5 h-3.5" />
                Choisir sur la carte
              </button>
            </div>
            {draft.latitude !== null && draft.longitude !== null ? (
              <div className="font-mono text-xs grid grid-cols-2 gap-3">
                <div>
                  <span className="text-fg-muted">Latitude :</span>{' '}
                  <span className="font-semibold">{draft.latitude.toFixed(6)}</span>
                </div>
                <div>
                  <span className="text-fg-muted">Longitude :</span>{' '}
                  <span className="font-semibold">{draft.longitude.toFixed(6)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-fg-muted italic">
                Aucune coordonnée saisie. Cliquez sur « Choisir sur la carte » pour
                pointer la localisation.
              </p>
            )}
          </div>

          <Field label="Constats">
            <textarea
              value={draft.constats}
              onChange={(e) => set('constats', e.target.value)}
              className="input min-h-[80px]"
              placeholder="Observations sur le terrain, état des ouvrages…"
            />
          </Field>

          <Field label="Recommandations">
            <textarea
              value={draft.recommandations}
              onChange={(e) => set('recommandations', e.target.value)}
              className="input min-h-[80px]"
              placeholder="Actions à mener suite à la visite…"
            />
          </Field>

          {/* Ouvrages visites — liste editable. Add/remove sont stockes en
              local par le parent ; le sync DB se fait au moment du save. */}
          <div className="border border-border rounded-lg p-3 bg-surface2">
            <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2 flex items-center gap-2">
              Ouvrages visités
              {ouvrages.length > 0 && (
                <span className="inline-flex items-center bg-primary text-white rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums normal-case tracking-normal">
                  {ouvrages.length}
                </span>
              )}
            </div>

            {ouvrages.length === 0 ? (
              <p className="text-xs text-fg-muted italic mb-2">
                Aucun ouvrage associé. Ajoutez-en ci-dessous.
              </p>
            ) : (
              <ul className="space-y-1.5 mb-3">
                {ouvrages.map((o, i) => {
                  const typeLabel = o.typeOuvrage
                    ? typesOuvrage.find((t) => t.code === o.typeOuvrage)?.label ??
                      o.typeOuvrage
                    : null;
                  return (
                    <li
                      key={o.id ?? `new-${i}`}
                      className="flex items-center gap-2 p-2 border border-border rounded bg-surface text-sm"
                    >
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-100 text-primary-700 font-mono text-[10px] font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      <Construction className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{o.nomOuvrage}</div>
                        {typeLabel && (
                          <div className="text-[10.5px] text-fg-muted">{typeLabel}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveOuvrage(i)}
                        className="text-fg-muted hover:text-danger p-1 rounded"
                        aria-label={`Retirer ${o.nomOuvrage}`}
                        title="Retirer cet ouvrage"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Bloc d'ajout — visuellement distinct */}
            <div className="border-2 border-dashed border-primary-100 bg-primary-100/20 rounded-lg p-2.5">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-primary-700 mb-2">
                Ajouter un ouvrage
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <input
                  type="text"
                  value={newNom}
                  onChange={(e) => setNewNom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOuvrage();
                    }
                  }}
                  placeholder="Nom de l'ouvrage"
                  className="input flex-1 min-w-[160px] text-sm"
                />
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="select w-40 text-sm"
                  aria-label="Type d'ouvrage"
                >
                  <option value="">Type d'ouvrage…</option>
                  {typesOuvrage.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddOuvrage}
                  className="btn btn-secondary btn-sm"
                >
                  <Plus className="w-3 h-3" /> Ajouter
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border bg-surface2 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSave}
            disabled={saving || !draft.dateMission || !draft.localite}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ label, required, children }: FieldProps) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-fg-muted mb-1">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
    </label>
  );
}
