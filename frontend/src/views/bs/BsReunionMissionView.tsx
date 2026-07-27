import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Construction,
  ExternalLink,
  Loader2,
  Lock,
  MapPin,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import {
  type CreateMissionTerrainInput,
  type CreateReunionTechniqueInput,
  REGIONS_SENEGAL,
  type RegionSenegal,
  type ReunionTechnique,
  type SousSecteur,
} from '@mha-bs/shared';

import { ConfirmDialog } from '../../components/ui/ConfirmDialog.js';
import { FormField } from '../../components/ui/FormField.js';
import {
  NotesPriveesField,
  clearNotesDraft,
  readNotesDraft,
} from '../../components/ui/NotesPriveesField.js';
import { Textarea } from '../../components/ui/Textarea.js';
import { useAuthStore } from '../../stores/authStore.js';
import { useReferentiel } from '../../hooks/useReferentiel.js';
import { ApiClientError, api, formatApiError } from '../../lib/apiClient.js';
import { cn } from '../../lib/cn.js';
import { todayYmd } from '../../lib/formatDate.js';

type Mode = 'reunion' | 'mission';

interface ReunionFormValues {
  dateReunion: string;
  heureDebut: string;
  dureeEstimee: string;
  theme: string;
  lieu: string;
  // Multi-selection : une reunion peut relever de plusieurs sous-secteurs et
  // etre rattachee a plusieurs COPIL/projets.
  sousSecteurs: SousSecteur[];
  copilLies: string[];
  typeReunion: string;
  ordreDuJour: string;
  decisions: string;
  notesPrivees: string;
  participantsRaw: string;
  visibleSg: boolean;
  inclusRapportHebdo: boolean;
}

interface MissionFormValues {
  dateMission: string;
  localite: string;
  region: RegionSenegal | '';
  latitude: string;
  longitude: string;
  projetRattache: string;
  constats: string;
  recommandations: string;
}

interface Ouvrage {
  nomOuvrage: string;
  typeOuvrage: string | null;
  etatOuvrage: 'fonctionnel' | 'maintenance' | 'horsService' | 'enConstruction';
}

const SENEGAL_CENTER: [number, number] = [14.7167, -17.4677];

// Icone leaflet custom (sinon icones par defaut cassees en bundle)
const PIN_ICON = L.divIcon({
  className: '',
  html: '<div style="background:#0284C7;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:11px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25)">●</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

/**
 * Saisie d'une reunion en DEUX etapes.
 *
 *  - `creation`   : contexte + theme, rien d'autre. Le bouton cree la reunion
 *                   (POST /reunions) et fait donc exister un id.
 *  - `complement` : le reste du formulaire — dont les NOTES PRIVEES, qui ont
 *                   besoin d'une reunion reelle a laquelle s'attacher (avant,
 *                   elles ne vivaient qu'en brouillon localStorage et etaient
 *                   perdues si le formulaire n'etait jamais soumis).
 *
 * L'id est porte par la query string (`?reunion=<uuid>`) : un rechargement de
 * page reprend donc l'etape 2 au lieu de repartir de zero.
 */
type EtapeReunion = 'creation' | 'complement';

/**
 * Valeurs d'un formulaire reunion vierge (etape 1).
 * Fonction et non constante : `todayYmd()` doit etre evalue au moment ou l'on
 * repart sur une saisie vierge, pas au chargement du module.
 */
function reunionDefaults(): ReunionFormValues {
  return {
    dateReunion: todayYmd(),
    heureDebut: '10:00',
    dureeEstimee: '2h',
    theme: '',
    lieu: 'SG MHA · Salle Plénière',
    sousSecteurs: [],
    copilLies: [],
    typeReunion: 'technique',
    ordreDuJour: '',
    decisions: '',
    notesPrivees: '',
    participantsRaw: 'Cabinet MHA, DPGI, ONAS',
    // Non publiee par defaut : c'est l'etape 2 qui rend la reunion visible au SG.
    visibleSg: false,
    inclusRapportHebdo: false,
  };
}

/** Cle localStorage du brouillon de notes — scopee par user ET par reunion. */
function notesDraftKey(userId: string | undefined, reunionId: string): string {
  return `bs-reunion-notes-draft-${userId ?? 'anon'}-${reunionId}`;
}

/** Reunion renvoyee par l'API -> valeurs du formulaire (jamais de null dans un input). */
function toReunionFormValues(
  r: ReunionTechnique,
  notesDraft: { content: string; ts: number } | null,
): ReunionFormValues {
  // Le brouillon local ne l'emporte que s'il est PLUS RECENT que la derniere
  // ecriture serveur (colonne "updatedAt", maintenue par trgReunionsUpdatedAt).
  // Sinon un brouillon perime — second onglet, session precedente — viendrait
  // ecraser des notes deja enregistrees au prochain « Enregistrer ».
  const brouillonPlusRecent = notesDraft != null && notesDraft.ts > Date.parse(r.updatedAt);
  // L'etape 1 ne collecte ni le lieu ni les participants : ils arrivent donc
  // vides ici. On re-propose les valeurs par defaut de la maison plutot que
  // d'ouvrir l'etape 2 sur des champs blancs — et on le fait ICI pour que
  // « continuer apres creation » et « rouvrir depuis la liste » se comportent
  // exactement pareil. Contrepartie assumee : un lieu volontairement vide se
  // reproposera a la reouverture.
  const defauts = reunionDefaults();
  return {
    dateReunion: r.dateReunion,
    heureDebut: r.heureDebut ?? '',
    dureeEstimee: r.dureeEstimee ?? '',
    theme: r.theme,
    lieu: r.lieu ?? defauts.lieu,
    sousSecteurs: r.sousSecteurs,
    copilLies: r.copilLies,
    typeReunion: r.typeReunion ?? '',
    ordreDuJour: r.ordreDuJour ?? '',
    decisions: r.decisions ?? '',
    notesPrivees: brouillonPlusRecent ? notesDraft.content : r.notesPrivees ?? '',
    participantsRaw:
      r.participants.length > 0 ? r.participants.join(', ') : defauts.participantsRaw,
    visibleSg: r.visibleSg,
    inclusRapportHebdo: r.inclusRapportHebdo,
  };
}

export function BsReunionMissionView() {
  const [mode, setMode] = useState<Mode>('reunion');
  const [submitting, setSubmitting] = useState(false);
  // Verrou anti-double-soumission, en ref pour etre lu/ecrit dans le meme tick.
  const envoiEnCoursRef = useRef(false);
  const [ouvrages, setOuvrages] = useState<Ouvrage[]>([]);
  const userId = useAuthStore((s) => s.user?.id);
  const role = useAuthStore((s) => s.user?.role);

  // L'id de la reunion en cours de saisie vit dans l'URL : l'etape 2 survit
  // donc a un rechargement de page (cf. commentaire sur EtapeReunion).
  const [searchParams, setSearchParams] = useSearchParams();
  const reunionId = searchParams.get('reunion');
  const etape: EtapeReunion = reunionId ? 'complement' : 'creation';

  // Etat serveur de la reunion actuellement editee. Source unique pour :
  //   - savoir si le formulaire reflete bien la reunion de l'URL (`id`)
  //   - la garde « notes privees » (`createdBy`)
  //   - le jeton de verrou optimiste (`version`)
  const [reunionChargee, setReunionChargee] = useState<ReunionTechnique | null>(null);
  const [chargement, setChargement] = useState(false);
  const estCreateur = reunionChargee != null && reunionChargee.createdBy === userId;

  // Miroir de la regle backend : le Bureau de Suivi travaille en commun, tout
  // profil bs (et admin) peut modifier n'importe quelle reunion apres
  // enregistrement. Un sg/reader qui atteindrait ce formulaire reste en lecture
  // seule (l'API refuserait de toute facon son PUT).
  //
  // NB : ceci ne concerne QUE le corps de la reunion. Les notes privees restent
  // gardees a part par `estCreateur` (fieldset masque + non transmises au PUT).
  const peutModifier = role === 'bs' || role === 'admin';

  // Referentiels charges depuis l'API (gerables via /bs/config)
  const sousSecteursRef = useReferentiel('sousSecteur');
  const copilProjetRef = useReferentiel('copilProjet');
  const typeReunionRef = useReferentiel('typeReunion');
  const typeOuvrageRef = useReferentiel('typeOuvrage');

  const reunionForm = useForm<ReunionFormValues>({ defaultValues: reunionDefaults() });
  // Lu PENDANT le rendu, volontairement : le formState de RHF est un Proxy qui
  // n'abonne le composant qu'aux cles effectivement lues au rendu. Lu seulement
  // dans un handler, `isDirty` resterait fige a false.
  const reunionDirty = reunionForm.formState.isDirty;

  // Les listes deroulantes (type de reunion, sous-secteur, COPIL) sont
  // alimentees par des referentiels charges en asynchrone. Tant qu'elles sont
  // vides, un reset() qui pose `sousSecteur: 'inondations'` ne trouve aucune
  // <option> correspondante : le <select> retombe sur « — » et la valeur est
  // silencieusement perdue au prochain enregistrement. On attend donc que les
  // trois referentiels du formulaire reunion soient arrives.
  const referentielsPrets =
    !sousSecteursRef.isLoading && !copilProjetRef.isLoading && !typeReunionRef.isLoading;

  // Hydratation de l'etape 2 : si l'URL porte deja un ?reunion=<id> (retour,
  // rechargement, lien colle), on recharge la reunion depuis l'API.
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [conflit, setConflit] = useState<ReunionTechnique | null>(null);
  const [rechargeCount, setRechargeCount] = useState(0);
  useEffect(() => {
    if (!reunionId || !referentielsPrets || reunionChargee?.id === reunionId) return;
    let annule = false;
    setChargement(true);
    setErreurChargement(null);
    api
      .get<ReunionTechnique>(`/reunions/${reunionId}`)
      .then((r) => {
        if (annule) return;
        setReunionChargee(r);
        setConflit(null);
        const draft = readNotesDraft(notesDraftKey(userId, reunionId));
        reunionForm.reset(toReunionFormValues(r, draft));
      })
      .catch((err: unknown) => {
        if (annule) return;
        // 404 : la reunion n'existe plus -> retour propre a l'etape 1.
        // Panne reseau : on GARDE `?reunion=` et on bloque le formulaire. Vider
        // l'id renverrait l'utilisateur en creation avec des valeurs par defaut,
        // et un « Enregistrer » ecraserait la vraie reunion — ou en creerait un
        // doublon.
        const introuvable = err instanceof ApiClientError && err.status === 404;
        if (introuvable) {
          toast.error('Réunion introuvable — retour à la création');
          // Remise a zero du formulaire, sinon il garde le contenu de la
          // reunion precedemment hydratee : un « Créer » sur cet ecran en
          // ferait un doublon.
          setReunionChargee(null);
          reunionForm.reset(reunionDefaults());
          setSearchParams({}, { replace: true });
        } else {
          setErreurChargement(formatApiError(err, 'Chargement de la réunion impossible'));
        }
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
      // Sans ce reset, une annulation (changement de dependance, passage a
      // l'etape 1 pendant le chargement) laisse `chargement` bloque a true et
      // le bouton Enregistrer desactive pour de bon.
      setChargement(false);
    };
  }, [
    reunionId,
    userId,
    referentielsPrets,
    rechargeCount,
    reunionChargee,
    reunionForm,
    setSearchParams,
  ]);

  // Formulaire gele tant qu'il n'affiche pas le vrai contenu de la reunion :
  // sinon l'etape 2 s'ouvre sur les valeurs par defaut (le temps du GET, ou si
  // celui-ci echoue) et un « Enregistrer » les ecrirait par-dessus la reunion.
  const reunionVerrouillee =
    etape === 'complement' &&
    (reunionChargee?.id !== reunionId ||
      chargement ||
      erreurChargement !== null ||
      !peutModifier);

  const missionForm = useForm<MissionFormValues>({
    defaultValues: {
      dateMission: todayYmd(),
      localite: '',
      region: 'Dakar',
      latitude: String(SENEGAL_CENTER[0]),
      longitude: String(SENEGAL_CENTER[1]),
      projetRattache: '',
      constats: '',
      recommandations: '',
    },
  });

  /**
   * ETAPE 1 — cree la reunion avec le strict minimum (contexte + theme).
   * Seules ces cles sont envoyees : le schema partage rend les autres
   * facultatives, inutile de fabriquer des `null` cote client.
   */
  const creerReunion = async (v: ReunionFormValues): Promise<void> => {
    // Meme garde que completerReunion : sans elle un double clic cree deux
    // reunions, dont une orpheline (l'URL ne pointe que sur la derniere).
    if (envoiEnCoursRef.current) return;
    envoiEnCoursRef.current = true;
    setSubmitting(true);
    try {
      const payload: CreateReunionTechniqueInput = {
        dateReunion: v.dateReunion,
        heureDebut: v.heureDebut || null,
        dureeEstimee: v.dureeEstimee || null,
        theme: v.theme.trim(),
        sousSecteurs: v.sousSecteurs,
        copilLies: v.copilLies,
        typeReunion: v.typeReunion || null,
        // Une reunion sortie de l'etape 1 n'a ni lieu, ni participants, ni
        // ordre du jour : elle ne doit pas remonter au SG dans cet etat. C'est
        // l'etape 2 qui la publie, en cochant « Visible au SG ».
        visibleSg: false,
      };
      const created = await api.post<ReunionTechnique>('/reunions', payload);
      // L'etat serveur est deja connu -> on court-circuite l'effet d'hydratation
      setReunionChargee(created);
      setConflit(null);
      reunionForm.reset(toReunionFormValues(created, null));
      setSearchParams({ reunion: created.id }, { replace: true });
      toast.success('Réunion créée — complétez-la, puis publiez-la vers le SG');
    } catch (err) {
      toast.error(formatApiError(err, 'Erreur à la création de la réunion'));
    } finally {
      envoiEnCoursRef.current = false;
      setSubmitting(false);
    }
  };

  /**
   * ETAPE 2 — enregistre le formulaire complet sur la reunion deja creee.
   *
   * Verrou optimiste : on renvoie la `version` telle qu'elle etait au
   * chargement. Si quelqu'un a enregistre entre temps, l'API repond 409 et on
   * affiche le bandeau de conflit au lieu d'ecraser son travail. `forcer`
   * omet le jeton — l'ecrasement devient alors un choix explicite.
   */
  const completerReunion = async (
    v: ReunionFormValues,
    { forcer = false }: { forcer?: boolean } = {},
  ): Promise<void> => {
    if (!reunionId) return;
    // Garde par ref et non par le state `submitting` : deux clics dans le meme
    // tick lisent tous les deux `submitting === false` (React n'a pas encore
    // re-rendu). Les deux PUT partiraient avec la meme `expectedVersion`, le
    // second se prendrait un 409 provoque par le premier — un faux conflit
    // avec soi-meme.
    if (envoiEnCoursRef.current) return;
    envoiEnCoursRef.current = true;
    setSubmitting(true);
    try {
      const payload: Partial<CreateReunionTechniqueInput> & { expectedVersion?: number } = {
        dateReunion: v.dateReunion,
        heureDebut: v.heureDebut || null,
        dureeEstimee: v.dureeEstimee || null,
        theme: v.theme.trim(),
        lieu: v.lieu || null,
        sousSecteurs: v.sousSecteurs,
        copilLies: v.copilLies,
        typeReunion: v.typeReunion || null,
        ordreDuJour: v.ordreDuJour || null,
        decisions: v.decisions || null,
        participants: v.participantsRaw.split(',').map((s) => s.trim()).filter(Boolean),
        visibleSg: v.visibleSg,
        inclusRapportHebdo: v.inclusRapportHebdo,
      };
      // `notesPrivees` n'est transmis QUE par le createur : le backend renvoie
      // un 403 des que ce champ est present dans le body d'un autre profil, ce
      // qui bloquerait l'enregistrement de tout le reste du formulaire.
      if (estCreateur) payload.notesPrivees = v.notesPrivees || null;
      if (!forcer && reunionChargee) payload.expectedVersion = reunionChargee.version;

      const maj = await api.put<ReunionTechnique>(`/reunions/${reunionId}`, payload);
      // Le jeton de verrou a avance : sans ce report, le 2e enregistrement
      // d'affilee renverrait une version perimee et partirait en faux conflit.
      setReunionChargee(maj);
      setConflit(null);
      // Brouillon localStorage n'est plus utile -> on nettoie
      if (estCreateur) clearNotesDraft(notesDraftKey(userId, reunionId));
      // Reset sur les valeurs qui viennent d'etre enregistrees : sans ca le
      // formulaire reste `isDirty` et la confirmation « modifications non
      // enregistrees » se declenche a tort au clic suivant.
      reunionForm.reset({ ...v, theme: v.theme.trim() });
      toast.success(v.visibleSg ? 'Réunion enregistrée et publiée' : 'Réunion enregistrée');
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        // `?? reunionChargee` : si le corps du 409 n'a pas la reunion (proxy qui
        // rogne les details, version d'API differente), on retombe sur ce qu'on
        // connait plutot que sur null — sinon le bandeau ne s'afficherait pas
        // et l'enregistrement resterait bloque sans aucune explication.
        const details = err.details as { reunion?: ReunionTechnique } | undefined;
        setConflit(details?.reunion ?? reunionChargee);
        toast.error('Réunion modifiée entre temps — rien n’a été écrasé');
        return;
      }
      toast.error(formatApiError(err, 'Erreur à l\'enregistrement de la réunion'));
    } finally {
      envoiEnCoursRef.current = false;
      setSubmitting(false);
    }
  };

  /** Repart sur une saisie vierge (retour etape 1). */
  const nouvelleReunion = (): void => {
    setReunionChargee(null);
    setConflit(null);
    setErreurChargement(null);
    reunionForm.reset(reunionDefaults());
    setSearchParams({}, { replace: true });
  };

  /** Conflit : abandonne les modifications locales et recharge l'etat serveur. */
  const rechargerApresConflit = (): void => {
    // Le bouton promet « perd ma saisie » : il faut donc AUSSI jeter le
    // brouillon localStorage des notes, sinon l'hydratation le reinjecte (il
    // est plus recent que updatedAt) et la saisie annoncee perdue revient.
    if (reunionId && estCreateur) clearNotesDraft(notesDraftKey(userId, reunionId));
    setConflit(null);
    setReunionChargee(null); // force l'effet d'hydratation a refaire le GET
  };

  /**
   * Conflit : ecrase volontairement la version du collegue.
   * Le bandeau n'est PAS efface ici — seul un PUT reussi le retire. Sinon une
   * validation qui echoue (theme vide, par exemple) ferait disparaitre le
   * bandeau sans qu'aucune requete ne parte : plus d'explication a l'ecran, et
   * le bouton Enregistrer normal continuerait a echouer en 409.
   */
  const ecraserMalgreConflit = (): void => {
    void reunionForm.handleSubmit((v) => completerReunion(v, { forcer: true }))();
  };

  // Confirmation avant de quitter l'etape 2 avec des modifications non
  // enregistrees (jamais de confirm() natif — cf. ConfirmDialog).
  const [confirmNouvelle, setConfirmNouvelle] = useState(false);
  const demanderNouvelleReunion = (): void => {
    if (reunionDirty) setConfirmNouvelle(true);
    else nouvelleReunion();
  };

  const submitMission = async (v: MissionFormValues): Promise<void> => {
    setSubmitting(true);
    try {
      // Number() renvoie NaN sur une saisie non numérique, et Zod rejette NaN
      // ('Expected number, received nan') -> on ne transmet que des nombres finis.
      const toCoord = (raw: string): number | null => {
        if (!raw) return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      };
      const payload: CreateMissionTerrainInput = {
        dateMission: v.dateMission,
        localite: v.localite.trim(),
        region: v.region || null,
        latitude: toCoord(v.latitude),
        longitude: toCoord(v.longitude),
        projetRattache: v.projetRattache || null,
        constats: v.constats || null,
        recommandations: v.recommandations || null,
      };
      const created = await api.post<{ id: string }>('/missions', payload);
      // Ajout des ouvrages
      for (const o of ouvrages) {
        await api.post(`/missions/${created.id}/ouvrages`, o);
      }
      toast.success(`Mission enregistrée${ouvrages.length > 0 ? ` avec ${ouvrages.length} ouvrage(s)` : ''}`);
      missionForm.reset();
      setOuvrages([]);
    } catch (err) {
      toast.error(formatApiError(err, 'Erreur à l\'enregistrement de la mission'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Link
        to="/bs/liste"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted mb-3 hover:text-fg"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Retour
      </Link>

      <h1 className="text-2xl font-semibold text-fg leading-tight">Nouvelle réunion ou mission</h1>
      <p className="text-sm text-fg-muted mt-1 mb-5">
        Enregistrer une réunion technique du MHA ou une mission de suivi d'ouvrage sur le terrain
      </p>

      {/* Toggle mode */}
      <div className="inline-flex p-1 bg-muted rounded-lg mb-5">
        <button
          type="button"
          onClick={() => setMode('reunion')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2',
            mode === 'reunion' ? 'bg-surface text-fg shadow-sm' : 'text-fg-2 hover:text-fg',
          )}
        >
          <Users className="w-3.5 h-3.5" /> Réunion technique
        </button>
        <button
          type="button"
          onClick={() => setMode('mission')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2',
            mode === 'mission' ? 'bg-surface text-fg shadow-sm' : 'text-fg-2 hover:text-fg',
          )}
        >
          <MapPin className="w-3.5 h-3.5" /> Mission terrain
        </button>
      </div>

      {mode === 'reunion' && (
        <form
          onSubmit={(e) =>
            void reunionForm.handleSubmit(
              // Lambda et non reference directe : RHF passe l'evenement en 2e
              // argument, ce qui viendrait ecraser les options de
              // `completerReunion` (`{ forcer }`).
              etape === 'creation' ? (v) => creerReunion(v) : (v) => completerReunion(v),
            )(e)
          }
          className="card overflow-hidden grid grid-cols-1"
        >
          {/* Fil d'etapes : la reunion doit exister avant de pouvoir accueillir
              ordre du jour, decisions et surtout notes privees. */}
          <div className="px-5 py-3.5 border-b border-border bg-surface2/40">
            <div className="flex items-center gap-3">
              <EtapeBadge numero={1} label="Créer" etat={etape === 'creation' ? 'actif' : 'fait'} />
              <div
                className={cn(
                  'h-0.5 flex-1 rounded-full',
                  etape === 'complement' ? 'bg-primary' : 'bg-border',
                )}
              />
              <EtapeBadge
                numero={2}
                label="Compléter"
                etat={etape === 'complement' ? 'actif' : 'inactif'}
              />
            </div>
            <p className="text-[11.5px] text-fg-muted mt-2">
              {etape === 'creation'
                ? 'Renseignez le contexte et le thème, puis créez la réunion. Le reste du formulaire — dont les notes privées — s’ouvrira ensuite.'
                : 'La réunion existe. Complétez-la autant de fois que nécessaire : chaque enregistrement met à jour la même réunion.'}
            </p>
          </div>

          {chargement && (
            <div className="px-5 py-2 border-b border-border flex items-center gap-2 text-xs text-fg-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement de la réunion…
            </div>
          )}

          {conflit !== null && (
            <div className="px-5 py-3 border-b border-border bg-warning-bg text-warning text-sm">
              <div className="flex items-start gap-2 mb-2">
                <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <b>Cette réunion a été modifiée entre temps</b>
                  {conflit.updatedAt && (
                    <span className="text-[11.5px] opacity-80">
                      {' '}
                      · dernière écriture le{' '}
                      {new Date(conflit.updatedAt).toLocaleString('fr-FR')}
                    </span>
                  )}
                  <div className="text-[11.5px] mt-0.5">
                    Rien n’a été écrasé. Rechargez pour repartir de la version enregistrée,
                    ou forcez si vous êtes sûr que votre saisie fait référence.
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={rechargerApresConflit}
                >
                  <RotateCcw className="w-3 h-3" /> Recharger (perd ma saisie)
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={ecraserMalgreConflit}
                  disabled={submitting}
                >
                  Écraser quand même
                </button>
              </div>
            </div>
          )}

          {etape === 'complement' && !peutModifier && !chargement && (
            <div className="px-5 py-3 border-b border-border bg-muted text-fg-2 text-sm flex items-start gap-2">
              <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                <b>Consultation seule.</b> Votre profil ne permet pas de modifier les
                réunions du Bureau de Suivi.
              </span>
            </div>
          )}

          {erreurChargement && (
            <div className="px-5 py-3 border-b border-border bg-danger-bg text-danger flex items-center gap-3 flex-wrap text-sm">
              <span className="flex-1">
                {erreurChargement} — le formulaire est bloqué pour ne pas écraser la réunion
                avec des valeurs par défaut.
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setRechargeCount((c) => c + 1)}
              >
                <RotateCcw className="w-3 h-3" /> Réessayer
              </button>
            </div>
          )}

          <fieldset className="p-5 border-b border-border" disabled={reunionVerrouillee}>
            <legend className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-4">
              Contexte
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* `required` porte un MESSAGE : avec `required: true`, RHF bloque
                  la soumission avec un message vide et l'utilisateur ne voit
                  rien se passer au clic sur Créer. */}
              <FormField
                label="Date"
                required
                error={reunionForm.formState.errors.dateReunion?.message}
              >
                <input
                  type="date"
                  className="input font-mono"
                  {...reunionForm.register('dateReunion', { required: 'Date requise' })}
                />
              </FormField>
              <FormField label="Heure">
                <input
                  type="time"
                  className="input font-mono"
                  {...reunionForm.register('heureDebut')}
                />
              </FormField>
              <FormField label="Durée estimée">
                <input type="text" className="input font-mono" {...reunionForm.register('dureeEstimee')} />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <FormField
                label="Type de réunion"
                help={
                  typeReunionRef.items.length === 0 && !typeReunionRef.isLoading
                    ? 'Aucun type défini. Ajoutez-en via Configuration.'
                    : undefined
                }
              >
                <select className="select" {...reunionForm.register('typeReunion')}>
                  <option value="">—</option>
                  {typeReunionRef.items.map((t) => (
                    <option key={t.id} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            {/* Sous-secteurs et COPIL en MULTI-selection : on peut en cocher
                plusieurs. Rendus pleine largeur (et non dans la grille a 3
                colonnes) pour laisser respirer les cases. */}
            <Controller
              name="sousSecteurs"
              control={reunionForm.control}
              render={({ field }) => (
                <GroupeCases
                  label="Sous-secteurs"
                  aide={
                    sousSecteursRef.items.length === 0 && !sousSecteursRef.isLoading
                      ? 'Aucun sous-secteur défini. Ajoutez-en via Configuration.'
                      : 'Cochez un ou plusieurs sous-secteurs.'
                  }
                  options={sousSecteursRef.items.map((s) => ({ value: s.code, label: s.label }))}
                  values={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              name="copilLies"
              control={reunionForm.control}
              render={({ field }) => (
                <GroupeCases
                  label="Projets / COPIL rattachés"
                  aide="Cochez un ou plusieurs projets ou COPIL."
                  options={copilProjetRef.items.map((c) => ({ value: c.label, label: c.label }))}
                  values={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </fieldset>

          <fieldset className="p-5 border-b border-border" disabled={reunionVerrouillee}>
            <legend className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-4">
              Réunion
            </legend>
            <FormField
              label="Thème"
              required
              error={reunionForm.formState.errors.theme?.message}
            >
              <input
                type="text"
                className="input"
                placeholder="ex. Préparation hivernage 2026 · plan d'actions DPGI"
                {...reunionForm.register('theme', {
                  required: 'Thème requis',
                  // `validate` et NON `minLength` : le payload part avec
                  // `theme.trim()`, or minLength compte les espaces. « ␣␣a␣␣ »
                  // passerait la validation cliente puis serait rejete par le
                  // min(3) du backend (422).
                  validate: (v) =>
                    v.trim().length >= 3 || 'Thème : 3 caractères minimum',
                })}
              />
            </FormField>

            {etape === 'creation' ? (
              <p className="text-[11.5px] text-fg-muted">
                Lieu, participants, ordre du jour, décisions, notes privées et visibilité
                s’ajouteront à l’étape suivante.
              </p>
            ) : (
              <>
                <FormField label="Lieu" help="Saisie libre">
                  <input type="text" className="input" {...reunionForm.register('lieu')} />
                </FormField>
                <FormField label="Participants" help="Séparer les noms par des virgules">
                  <input
                    type="text"
                    className="input"
                    {...reunionForm.register('participantsRaw')}
                    placeholder="ex. Cabinet MHA, DPGI, ONAS, CPCSP"
                  />
                </FormField>
                <FormField label="Ordre du jour">
                  <Textarea
                    rows={4}
                    {...reunionForm.register('ordreDuJour')}
                    placeholder="Point 1 :&#10;Point 2 :"
                  />
                </FormField>
                <FormField label="Décisions / suites attendues">
                  <Textarea rows={3} {...reunionForm.register('decisions')} />
                </FormField>
              </>
            )}
          </fieldset>

          {/* Notes privees — disponibles seulement une fois la reunion creee
              (elles s'attachent a un id reel), et uniquement pour son createur.
              La meme garde existe cote backend : notesPrivees est renvoye null
              aux autres viewers et un PUT qui tente de l'ecrire est refuse. */}
          {etape === 'complement' && estCreateur && (
            <fieldset className="p-5 border-b border-border" disabled={reunionVerrouillee}>
              <legend className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-2">
                Notes privées
                <span className="ml-2 text-fg-muted/70 normal-case tracking-normal">
                  · texte libre, uniquement visible par vous
                </span>
              </legend>
              <Controller
                name="notesPrivees"
                control={reunionForm.control}
                render={({ field }) => (
                  <NotesPriveesField
                    value={field.value}
                    onChange={field.onChange}
                    storageKey={notesDraftKey(userId, reunionId ?? 'nouveau')}
                    rows={10}
                  />
                )}
              />
            </fieldset>
          )}

          {/* Un profil qui n'est pas le createur ne voit pas le bloc Notes : on
              le dit, sinon le bandeau d'etape promet une section absente. */}
          {etape === 'complement' && !estCreateur && !reunionVerrouillee && (
            <div className="px-5 py-3 border-b border-border text-[11.5px] text-fg-muted">
              Les notes privées de cette réunion appartiennent à son créateur — elles ne
              vous sont ni visibles ni modifiables.
            </div>
          )}

          {etape === 'complement' && (
            <fieldset className="p-5 border-b border-border" disabled={reunionVerrouillee}>
              <legend className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-2 flex items-center gap-2">
                Visibilité
                {reunionChargee && !reunionChargee.visibleSg && (
                  <span className="badge bg-muted text-fg-2 text-[10px] normal-case tracking-normal">
                    Non publiée
                  </span>
                )}
              </legend>
              <p className="text-[11.5px] text-fg-muted mb-3">
                Une réunion créée à l’étape 1 n’est pas publiée : elle reste invisible au SG
                tant que la case ci-dessous n’est pas cochée et enregistrée.
              </p>
              <label className="inline-flex items-center gap-2 text-sm mr-6">
                <input type="checkbox" className="accent-primary" {...reunionForm.register('visibleSg')} />{' '}
                Visible au SG
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary"
                  {...reunionForm.register('inclusRapportHebdo')}
                />{' '}
                Inclure dans le rapport hebdo
              </label>
            </fieldset>
          )}

          <div className="sticky bottom-0 bg-surface border-t border-border px-5 py-3.5 flex justify-between items-center gap-2 flex-wrap">
            {etape === 'creation' ? (
              <>
                <span />
                <div className="flex gap-2">
                  <Link to="/bs/liste" className="btn btn-ghost">
                    Annuler
                  </Link>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5" />
                    )}
                    {submitting ? 'Création…' : 'Créer et continuer'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={demanderNouvelleReunion}
                  className="btn btn-ghost"
                  title="Repartir sur une saisie vierge — la réunion actuelle reste enregistrée"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Nouvelle réunion
                </button>
                <div className="flex gap-2">
                  <Link to="/reunions-techniques" className="btn btn-ghost">
                    <ExternalLink className="w-3.5 h-3.5" /> Voir la liste
                  </Link>
                  {/* Aucun bouton Enregistrer si l'API refusera l'ecriture :
                      mieux vaut ne pas le proposer que de le griser sans dire
                      pourquoi (le bandeau « Consultation seule » l'explique). */}
                  {peutModifier && (
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submitting || reunionVerrouillee}
                    >
                      <Save className="w-3.5 h-3.5" />
                      {submitting ? 'Enregistrement…' : 'Enregistrer la réunion'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirmNouvelle}
        onOpenChange={setConfirmNouvelle}
        title="Repartir sur une nouvelle réunion ?"
        description="Les modifications non enregistrées de la réunion en cours seront perdues. La réunion elle-même reste enregistrée et reste modifiable depuis la liste."
        confirmLabel="Nouvelle réunion"
        onConfirm={nouvelleReunion}
      />


      {mode === 'mission' && (
        <form
          onSubmit={(e) => void missionForm.handleSubmit(submitMission)(e)}
          className="card overflow-hidden"
        >
          <fieldset className="p-5 border-b border-border">
            <legend className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-4">
              Contexte mission
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField label="Date" required>
                <input
                  type="date"
                  className="input font-mono"
                  {...missionForm.register('dateMission', { required: true })}
                />
              </FormField>
              <FormField label="Projet rattaché">
                <input
                  type="text"
                  className="input"
                  placeholder="ex. PROGEP II"
                  {...missionForm.register('projetRattache')}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField label="Localité" required>
                <input
                  type="text"
                  className="input"
                  placeholder="ex. Keur Massar — Tivaoune Peulh"
                  {...missionForm.register('localite', { required: 'Localité requise' })}
                />
              </FormField>
              <FormField label="Région">
                {/* Options issues de REGIONS_SENEGAL (la constante que le backend
                    valide), et NON du référentiel : ses libellés sont sans
                    accents ('Thies', 'Kedougou', 'Sedhiou') et étaient rejetés
                    par l'enum ('Thiès', 'Kédougou', 'Sédhiou') -> 422. */}
                <select className="select" {...missionForm.register('region')}>
                  <option value="">—</option>
                  {REGIONS_SENEGAL.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </fieldset>

          <fieldset className="p-5 border-b border-border">
            <legend className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-3">
              Géolocalisation
            </legend>
            <p className="text-xs text-fg-muted mb-2">Cliquez sur la carte pour positionner le site.</p>
            <Controller
              control={missionForm.control}
              name="latitude"
              render={({ field: latField }) => (
                <Controller
                  control={missionForm.control}
                  name="longitude"
                  render={({ field: lngField }) => (
                    <>
                      <div className="rounded border border-border overflow-hidden" style={{ height: 280 }}>
                        <MapContainer
                          center={[Number(latField.value) || SENEGAL_CENTER[0], Number(lngField.value) || SENEGAL_CENTER[1]]}
                          zoom={9}
                          scrollWheelZoom={false}
                          style={{ height: '100%', width: '100%' }}
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <ClickHandler
                            onPick={(lat, lng) => {
                              latField.onChange(String(lat.toFixed(6)));
                              lngField.onChange(String(lng.toFixed(6)));
                            }}
                          />
                          {Number(latField.value) && Number(lngField.value) && (
                            <Marker
                              position={[Number(latField.value), Number(lngField.value)]}
                              icon={PIN_ICON}
                            />
                          )}
                        </MapContainer>
                      </div>
                      <div className="flex gap-3 mt-2 text-xs font-mono text-fg-muted">
                        <span>
                          Latitude : <b className="text-fg-2">{latField.value || '—'}</b>
                        </span>
                        <span>
                          Longitude : <b className="text-fg-2">{lngField.value || '—'}</b>
                        </span>
                      </div>
                    </>
                  )}
                />
              )}
            />
          </fieldset>

          <fieldset className="p-5 border-b border-border">
            <legend className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-1 flex items-center gap-2">
              Ouvrages visités
              {ouvrages.length > 0 && (
                <span className="inline-flex items-center bg-primary text-white rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums normal-case tracking-normal">
                  {ouvrages.length}
                </span>
              )}
            </legend>
            <p className="text-[11.5px] text-fg-muted mb-3">
              Ajoutez autant d'ouvrages visités que nécessaire — cliquez « Ajouter »
              pour chaque ouvrage, puis enregistrez la mission tout en bas.
            </p>

            {/* Liste des ouvrages deja ajoutes (ou empty state guidant) */}
            {ouvrages.length === 0 ? (
              <div className="text-center py-6 mb-3 border-2 border-dashed border-border rounded-lg bg-surface2/30">
                <Construction className="w-5 h-5 text-fg-muted mx-auto mb-1.5" />
                <p className="text-sm text-fg-muted italic">
                  Aucun ouvrage encore. Saisissez le 1er ci-dessous.
                </p>
              </div>
            ) : (
              <ul className="space-y-2 mb-3">
                {ouvrages.map((o, i) => {
                  const typeLabel = o.typeOuvrage
                    ? typeOuvrageRef.items.find((t) => t.code === o.typeOuvrage)?.label ??
                      o.typeOuvrage
                    : null;
                  return (
                    <li
                      key={i}
                      className="flex items-center gap-2.5 p-3 border border-border rounded-lg bg-surface hover:bg-muted/40 transition-colors"
                    >
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-700 font-mono text-[11px] font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      <Construction className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{o.nomOuvrage}</div>
                        {typeLabel && (
                          <div className="text-[11px] text-fg-muted">{typeLabel}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setOuvrages((arr) => arr.filter((_, idx) => idx !== i))}
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

            {/* Bloc de saisie d'un nouvel ouvrage, visuellement distinct */}
            <div className="border-2 border-dashed border-primary-100 bg-primary-100/20 rounded-lg p-3">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-primary-700 mb-2">
                Ajouter un ouvrage
              </div>
              <NewOuvrageRow
                onAdd={(o) => setOuvrages((arr) => [...arr, o])}
                types={typeOuvrageRef.items.map((t) => ({ code: t.code, label: t.label }))}
              />
            </div>
          </fieldset>

          <fieldset className="p-5 border-b border-border">
            <legend className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-3">
              Constats & recommandations
            </legend>
            <FormField label="Constats">
              <Textarea
                rows={4}
                {...missionForm.register('constats')}
                placeholder="Observations sur l'état des ouvrages, anomalies, actions urgentes…"
              />
            </FormField>
            <FormField label="Recommandations">
              <Textarea rows={3} {...missionForm.register('recommandations')} />
            </FormField>
          </fieldset>

          <div className="sticky bottom-0 bg-surface border-t border-border px-5 py-3.5 flex justify-end gap-2">
            <Link to="/bs/liste" className="btn btn-ghost">
              Annuler
            </Link>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <Save className="w-3.5 h-3.5" />
              {submitting ? 'Enregistrement…' : 'Enregistrer la mission'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Pastille numerotee du fil d'etapes de la saisie reunion. */
/**
 * Groupe de cases a cocher pour une valeur MULTIPLE (sous-secteurs, COPIL).
 * Remplace le <select> simple : on peut cocher plusieurs entrees, ou tout.
 * L'ordre de `values` suit l'ordre de clic ; peu importe cote API (tableau).
 */
function GroupeCases({
  label,
  aide,
  options,
  values,
  onChange,
}: {
  label: string;
  aide?: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const toutCoche = options.length > 0 && options.every((o) => values.includes(o.value));
  // `values` vient du closure de rendu de RHF : deux clics dans le meme tick
  // (avant re-render) verraient tous deux l'ancienne valeur et le second
  // ecraserait le premier. Le ref, mis a jour a chaque rendu ET a chaque clic,
  // fait que le clic suivant part toujours de la selection la plus fraiche.
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const basculer = (value: string): void => {
    const cur = valuesRef.current;
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    valuesRef.current = next;
    onChange(next);
  };
  const toutOuRien = (): void => {
    onChange(toutCoche ? [] : options.map((o) => o.value));
  };

  return (
    <div className="mb-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="field-label mb-0">{label}</span>
        {options.length > 1 && (
          <button
            type="button"
            onClick={toutOuRien}
            className="text-[11.5px] text-primary hover:underline"
          >
            {toutCoche ? 'Tout décocher' : 'Tout cocher'}
          </button>
        )}
      </div>
      {options.length === 0 ? (
        <p className="field-help">{aide}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {options.map((o) => {
              const actif = values.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => basculer(o.value)}
                  aria-pressed={actif}
                  className={cn(
                    'inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full border text-[12.5px] transition-colors',
                    actif
                      ? 'border-primary bg-primary-100 text-primary-700 font-medium'
                      : 'border-border bg-surface text-fg-2 hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex items-center justify-center w-3.5 h-3.5 rounded-[4px] border flex-shrink-0',
                      actif ? 'bg-primary border-primary text-white' : 'border-fg-muted',
                    )}
                  >
                    {actif && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                  </span>
                  {o.label}
                </button>
              );
            })}
          </div>
          {aide && <p className="field-help mt-1">{aide}</p>}
        </>
      )}
    </div>
  );
}

function EtapeBadge({
  numero,
  label,
  etat,
}: {
  numero: number;
  label: string;
  etat: 'actif' | 'fait' | 'inactif';
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={cn(
          'inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold flex-shrink-0',
          etat === 'actif' && 'bg-primary text-white',
          etat === 'fait' && 'bg-primary-100 text-primary-700',
          etat === 'inactif' && 'bg-muted text-fg-muted',
        )}
      >
        {etat === 'fait' ? <Check className="w-3.5 h-3.5" /> : numero}
      </span>
      <span
        className={cn(
          'text-xs font-medium whitespace-nowrap',
          etat === 'inactif' ? 'text-fg-muted' : 'text-fg-2',
        )}
      >
        {label}
      </span>
    </div>
  );
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function NewOuvrageRow({
  onAdd,
  types,
}: {
  onAdd: (o: Ouvrage) => void;
  types: { code: string; label: string }[];
}) {
  const [nom, setNom] = useState('');
  const [typeOuvrage, setTypeOuvrage] = useState<string>('');

  // L'etat de l'ouvrage est cache cote UI (a la demande). On envoie systematiquement
  // 'fonctionnel' au backend (la colonne etatOuvrage a un NOT NULL CHECK).
  // Si plus tard on veut retracer l'etat, il suffit de re-introduire un dropdown ici.

  const handleAdd = (): void => {
    const trimmed = nom.trim();
    if (!trimmed) return;
    onAdd({
      nomOuvrage: trimmed,
      typeOuvrage: typeOuvrage || null,
      etatOuvrage: 'fonctionnel',
    });
    setNom('');
    setTypeOuvrage('');
  };

  return (
    <div className="flex gap-2 items-center flex-wrap">
      <input
        type="text"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
          }
        }}
        placeholder="Nom de l'ouvrage (ex. Bassin de rétention Keur Massar)"
        className="input flex-1 min-w-[200px]"
      />
      <select
        value={typeOuvrage}
        onChange={(e) => setTypeOuvrage(e.target.value)}
        className="select w-44"
        aria-label="Type d'ouvrage"
      >
        <option value="">Type d'ouvrage…</option>
        {types.map((t) => (
          <option key={t.code} value={t.code}>
            {t.label}
          </option>
        ))}
      </select>
      <button type="button" onClick={handleAdd} className="btn btn-secondary btn-sm">
        <Plus className="w-3 h-3" /> Ajouter
      </button>
    </div>
  );
}
