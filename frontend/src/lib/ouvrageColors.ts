import L from 'leaflet';

/**
 * Couleurs des marqueurs de la carte des missions, par famille d'ouvrage.
 *
 * OU VIT QUOI
 * -----------
 * Le RATTACHEMENT type -> famille vit dans la BASE : colonne
 * `referentiels.parentCode`, meme mecanique que typeMatrice -> matriceCategorie
 * (cf. le bloc de migration dans database/schema.sql). Un type ajoute via
 * /bs/config peut donc recevoir sa famille sans redeploiement.
 *
 * La PALETTE, elle, reste en code : ce ne sont pas des donnees metier mais des
 * valeurs validees, qu'on ne peut pas laisser modifier a l'aveugle.
 *
 * POURQUOI QUATRE FAMILLES ET NON UNE COULEUR PAR TYPE
 * ----------------------------------------------------
 * Sur une carte, deux marqueurs quelconques peuvent se toucher : c'est le cas
 * « toutes paires », le plus exigeant. Mesure au validateur de palette :
 *
 *   7 couleurs -> ecart CVD 3.2 (plancher 8) et surtout 12.9 en vision
 *                 NORMALE (plancher dur 15) : indistinguables meme sans
 *                 daltonisme.
 *   5 couleurs -> echoue encore (jaune ↔ orange, 13.7).
 *   4 couleurs -> passe (CVD 9.2, vision normale 16.3).
 *
 * Steps du mode CLAIR dans les deux themes de l'app : le marqueur repose sur
 * les tuiles OpenStreetMap, toujours claires, jamais sur la surface applicative.
 * Son anneau blanc de 3px l'isole du fond de carte.
 */

/** Code de famille tel que stocke dans `referentiels.parentCode`. */
export type FamilleOuvrage = string;

/** Famille de repli : type sans `parentCode`, ou famille inconnue de la palette. */
export const FAMILLE_AUTRE = 'autre';

/** Cle sentinelle : « mission sans aucun ouvrage saisi ». */
export const FAMILLE_AUCUNE = '__aucune__';

/**
 * Valeur sentinelle du filtre, pour cibler les missions SANS ouvrage saisi.
 * Sans elle on ne pourrait pas les isoler — or elles sont largement
 * majoritaires tant que la saisie des ouvrages n'est pas systematique.
 */
export const SANS_OUVRAGE = '__aucun__';

/**
 * Ordre FIXE, jamais recycle : la couleur suit la famille, pas son rang dans
 * les donnees affichees. Filtrer la carte ne doit pas repeindre les familles
 * restantes.
 */
const COULEURS: Readonly<Record<string, string>> = {
  inondations: '#2a78d6',
  assainissement: '#eb6834',
  eauPotable: '#1baf7a',
  autre: '#4a3aa7',
  // Neutre volontairement hors palette categorielle : « pas de donnee » n'est
  // pas une categorie de plus et ne doit pas se disputer l'attention.
  [FAMILLE_AUCUNE]: '#94a3b8',
};

/**
 * Une 5e famille creee via /bs/config n'aurait pas de couleur validee : elle
 * retombe sur celle de « autre » plutot que d'inventer une teinte qui
 * casserait les ecarts perceptuels mesures ci-dessus.
 */
export function couleurFamille(famille: FamilleOuvrage): string {
  return COULEURS[famille] ?? COULEURS[FAMILLE_AUTRE]!;
}

/**
 * Familles presentes sur une mission, dans l'ordre fixe de la palette.
 * `familleDeType` vient de l'appelant, qui seul connait le referentiel charge.
 * Renvoie `[FAMILLE_AUCUNE]` si la mission n'a aucun ouvrage type.
 */
export function famillesDeMission(
  typesOuvrages: readonly string[],
  familleDeType: (code: string) => FamilleOuvrage,
): FamilleOuvrage[] {
  const presentes = new Set(typesOuvrages.map(familleDeType));
  if (presentes.size === 0) return [FAMILLE_AUCUNE];
  return Object.keys(COULEURS).filter((f) => presentes.has(f));
}

/**
 * Fond CSS d'un marqueur. Une mission peut visiter plusieurs familles — plutot
 * que d'elire une famille « dominante » (choix arbitraire, information perdue),
 * le marqueur est decoupe en parts egales.
 */
export function fondMarqueur(familles: readonly FamilleOuvrage[]): string {
  if (familles.length <= 1) return couleurFamille(familles[0] ?? FAMILLE_AUCUNE);
  const pas = 100 / familles.length;
  const parts = familles.map((f, i) => `${couleurFamille(f)} ${i * pas}% ${(i + 1) * pas}%`);
  return `conic-gradient(${parts.join(', ')})`;
}

/**
 * Cache d'icones Leaflet, indexe par combinaison de familles.
 *
 * Indispensable, et non une optimisation : react-leaflet compare le prop `icon`
 * PAR IDENTITE (Marker.js — `props.icon !== prevProps.icon` -> `setIcon()`), et
 * `setIcon` detruit puis recree l'element DOM du marqueur. Une icone neuve a
 * chaque rendu ferait reconstruire tous les marqueurs au moindre changement
 * d'etat. Le cache est borne par le nombre de combinaisons de familles.
 *
 * Partager une instance entre marqueurs est le fonctionnement prevu par Leaflet
 * (`createIcon()` produit un element DOM par appel).
 */
const CACHE_ICONES = new Map<string, L.DivIcon>();

export function iconeFamilles(familles: readonly FamilleOuvrage[], taille = 28): L.DivIcon {
  // La taille entre dans la cle : la carte du dashboard utilise des pastilles
  // plus petites que celle du suivi des missions.
  const cle = `${taille}:${familles.join('|')}`;
  const enCache = CACHE_ICONES.get(cle);
  if (enCache) return enCache;

  const bordure = taille >= 26 ? 3 : 2;
  const fond = fondMarqueur(familles);
  const icone = L.divIcon({
    // className vide, sinon Leaflet applique son fond blanc par defaut.
    className: '',
    html: `<div style="background:${fond};width:${taille}px;height:${taille}px;border-radius:50%;border:${bordure}px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>`,
    iconSize: [taille, taille],
    iconAnchor: [taille / 2, taille / 2],
  });
  CACHE_ICONES.set(cle, icone);
  return icone;
}

/**
 * Ecarte en eventail les marqueurs qui partagent exactement le meme point.
 *
 * POURQUOI EN PIXELS ET NON EN DEGRES
 * -----------------------------------
 * Le geocodeur attribue le centroide de la region a beaucoup de missions : sept
 * groupes partagent un point a l'identique, jusqu'a cinq missions sur Touba.
 * Elles s'empilent alors au pixel pres et seule la couleur du dernier marqueur
 * rendu est lisible — le codage couleur ne sert plus a rien precisement la ou il
 * y a le plus de missions.
 *
 * Une premiere version decalait en DEGRES (~45 m). Mesure : au zoom national 33
 * marqueurs n'occupaient que 19 positions distinctes, 14 restaient caches. A ce
 * zoom, 45 m est tres inferieur au pixel. L'ecart doit donc etre exprime a
 * l'ecran, donc dependre du zoom — d'ou la projection.
 *
 * Disposition en cercle deterministe (ordre de la liste), stable d'un rendu a
 * l'autre. Un marqueur seul sur son point n'est jamais deplace.
 */
export function ecarterCoincidences<T extends { latitude: number; longitude: number }>(
  points: readonly T[],
  projection: {
    versPixels: (lat: number, lng: number) => { x: number; y: number };
    versLatLng: (x: number, y: number) => { lat: number; lng: number };
  } | null,
  rayonPixels = 16,
): (T & { position: [number, number] })[] {
  const groupes = new Map<string, T[]>();
  for (const p of points) {
    const cle = `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
    const groupe = groupes.get(cle);
    if (groupe) groupe.push(p);
    else groupes.set(cle, [p]);
  }

  const resultat: (T & { position: [number, number] })[] = [];
  for (const groupe of groupes.values()) {
    // Point unique, ou carte pas encore prete : on laisse la position d'origine.
    if (groupe.length === 1 || !projection) {
      for (const p of groupe) resultat.push({ ...p, position: [p.latitude, p.longitude] });
      continue;
    }
    // Le rayon grandit avec l'effectif, sinon a partir de ~6 marqueurs les
    // pastilles se rechevauchent sur le cercle.
    const rayon = Math.max(rayonPixels, (groupe.length * rayonPixels) / Math.PI);
    groupe.forEach((p, i) => {
      const angle = (2 * Math.PI * i) / groupe.length;
      const centre = projection.versPixels(p.latitude, p.longitude);
      const decale = projection.versLatLng(
        centre.x + rayon * Math.cos(angle),
        centre.y + rayon * Math.sin(angle),
      );
      resultat.push({ ...p, position: [decale.lat, decale.lng] });
    });
  }
  return resultat;
}
