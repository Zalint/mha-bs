/**
 * Gazetteer du Sénégal — base de données géographique embarquée (PAS de CDN ni
 * d'appel réseau). Permet de géocoder une localité à partir de son nom :
 *   - retour : { latitude, longitude, region }
 *   - sinon  : null
 *
 * Couvre les 14 régions + ~70 communes/villes courantes apparaissant dans les
 * fichiers d'import (missions terrain, interpellations…). Tout match est
 * insensible à la casse et aux accents.
 *
 * Sources des coordonnées : OpenStreetMap / Wikipedia (saisies à la main, pas
 * d'appel runtime). Précision suffisante pour pointer sur une ville (~1 km).
 */

export interface GazetteerEntry {
  /** Nom officiel/canonique de la localité. */
  readonly name: string;
  /** Variantes orthographiques connues (incluent le canonique). */
  readonly aliases: readonly string[];
  /** Région administrative (l'une des 14 régions du Sénégal). */
  readonly region: string;
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * Base de données. L'ordre n'a pas d'importance — le matcher cherche par alias
 * exact normalisé puis par inclusion (le plus long alias gagne).
 */
const GAZETTEER: readonly GazetteerEntry[] = [
  // -------------------- Région de Dakar --------------------
  { name: 'Dakar', aliases: ['Dakar', 'Dakar Plateau'], region: 'Dakar', latitude: 14.6928, longitude: -17.4467 },
  { name: 'Pikine', aliases: ['Pikine'], region: 'Dakar', latitude: 14.7548, longitude: -17.3961 },
  { name: 'Guédiawaye', aliases: ['Guédiawaye', 'Guediawaye'], region: 'Dakar', latitude: 14.7833, longitude: -17.4 },
  { name: 'Rufisque', aliases: ['Rufisque'], region: 'Dakar', latitude: 14.7167, longitude: -17.2667 },
  { name: 'Bargny', aliases: ['Bargny'], region: 'Dakar', latitude: 14.6928, longitude: -17.2244 },
  { name: 'Keur Massar', aliases: ['Keur Massar'], region: 'Dakar', latitude: 14.7799, longitude: -17.3344 },
  { name: 'Tivaouane Peulh', aliases: ['Tivaouane Peulh', 'Tivaouane-Peulh'], region: 'Dakar', latitude: 14.8167, longitude: -17.2667 },
  { name: 'Thiaroye Sur Mer', aliases: ['Thiaroye Sur Mer', 'Thiaroye-sur-Mer'], region: 'Dakar', latitude: 14.7461, longitude: -17.3192 },
  { name: 'Thiaroye', aliases: ['Thiaroye'], region: 'Dakar', latitude: 14.7572, longitude: -17.3486 },
  { name: 'Mbao', aliases: ['Mbao', 'APIX Mbao'], region: 'Dakar', latitude: 14.7333, longitude: -17.3667 },
  { name: 'Diamniadio', aliases: ['Diamniadio'], region: 'Dakar', latitude: 14.7222, longitude: -17.1881 },
  { name: 'Yeumbeul', aliases: ['Yeumbeul'], region: 'Dakar', latitude: 14.7833, longitude: -17.3667 },
  { name: 'Malika', aliases: ['Malika'], region: 'Dakar', latitude: 14.7867, longitude: -17.3461 },
  { name: 'Sébikotane', aliases: ['Sébikotane', 'Sebikotane'], region: 'Dakar', latitude: 14.7547, longitude: -17.1361 },
  { name: 'Yoff', aliases: ['Yoff'], region: 'Dakar', latitude: 14.7547, longitude: -17.4936 },

  // -------------------- Région de Thiès --------------------
  { name: 'Thiès', aliases: ['Thiès', 'Thies'], region: 'Thiès', latitude: 14.7833, longitude: -16.9167 },
  { name: 'Mbour', aliases: ['Mbour'], region: 'Thiès', latitude: 14.4131, longitude: -16.9658 },
  { name: 'Tivaouane', aliases: ['Tivaouane'], region: 'Thiès', latitude: 14.95, longitude: -16.8167 },
  { name: 'Joal-Fadiouth', aliases: ['Joal-Fadiouth', 'Joal Fadiouth', 'Joal'], region: 'Thiès', latitude: 14.1667, longitude: -16.85 },
  { name: 'Khombole', aliases: ['Khombole'], region: 'Thiès', latitude: 14.7669, longitude: -16.7019 },
  { name: 'Pout', aliases: ['Pout'], region: 'Thiès', latitude: 14.7711, longitude: -17.0617 },
  { name: 'Mékhé', aliases: ['Mékhé', 'Mekhe'], region: 'Thiès', latitude: 15.1167, longitude: -16.6333 },
  { name: 'Popenguine', aliases: ['Popenguine'], region: 'Thiès', latitude: 14.55, longitude: -17.1 },
  { name: 'Nguékhokh', aliases: ['Nguékhokh', 'Nguekhokh'], region: 'Thiès', latitude: 14.5183, longitude: -17.0156 },

  // -------------------- Région de Diourbel --------------------
  { name: 'Diourbel', aliases: ['Diourbel'], region: 'Diourbel', latitude: 14.6531, longitude: -16.2342 },
  { name: 'Touba', aliases: ['Touba', 'Touba Mosquée'], region: 'Diourbel', latitude: 14.85, longitude: -15.8833 },
  { name: 'Mbacké', aliases: ['Mbacké', 'Mbacke'], region: 'Diourbel', latitude: 14.7917, longitude: -15.9081 },
  { name: 'Bambey', aliases: ['Bambey'], region: 'Diourbel', latitude: 14.7, longitude: -16.45 },

  // -------------------- Région de Saint-Louis --------------------
  { name: 'Saint-Louis', aliases: ['Saint-Louis', 'Saint Louis', 'St-Louis', 'St Louis', 'Ndar'], region: 'Saint-Louis', latitude: 16.0179, longitude: -16.4896 },
  { name: 'Dagana', aliases: ['Dagana'], region: 'Saint-Louis', latitude: 16.5167, longitude: -15.5 },
  { name: 'Podor', aliases: ['Podor'], region: 'Saint-Louis', latitude: 16.6519, longitude: -14.9606 },
  { name: 'Richard-Toll', aliases: ['Richard-Toll', 'Richard Toll'], region: 'Saint-Louis', latitude: 16.4625, longitude: -15.7008 },
  { name: 'Ross-Béthio', aliases: ['Ross-Béthio', 'Ross Bethio', 'Rosso Bethio', 'Rosso-Bethio'], region: 'Saint-Louis', latitude: 16.45, longitude: -16.0833 },
  { name: 'Mpal', aliases: ['Mpal'], region: 'Saint-Louis', latitude: 15.9, longitude: -16.2667 },

  // -------------------- Région de Kaolack --------------------
  { name: 'Kaolack', aliases: ['Kaolack'], region: 'Kaolack', latitude: 14.1817, longitude: -16.2531 },
  { name: 'Kahone', aliases: ['Kahone'], region: 'Kaolack', latitude: 14.1667, longitude: -16.1667 },
  { name: 'Guinguinéo', aliases: ['Guinguinéo', 'Guinguineo'], region: 'Kaolack', latitude: 14.2667, longitude: -15.95 },
  { name: 'Nioro du Rip', aliases: ['Nioro du Rip', 'Nioro', 'Nioro Commune'], region: 'Kaolack', latitude: 13.7464, longitude: -15.7906 },

  // -------------------- Région de Ziguinchor --------------------
  { name: 'Ziguinchor', aliases: ['Ziguinchor'], region: 'Ziguinchor', latitude: 12.5681, longitude: -16.2719 },
  { name: 'Bignona', aliases: ['Bignona'], region: 'Ziguinchor', latitude: 12.8108, longitude: -16.2306 },
  { name: 'Oussouye', aliases: ['Oussouye'], region: 'Ziguinchor', latitude: 12.4847, longitude: -16.5475 },
  { name: 'Nyassia', aliases: ['Nyassia', 'Commune de Nyassia'], region: 'Ziguinchor', latitude: 12.4825, longitude: -16.2522 },
  { name: 'Cap Skirring', aliases: ['Cap Skirring', 'Cap-Skirring'], region: 'Ziguinchor', latitude: 12.395, longitude: -16.745 },

  // -------------------- Région de Tambacounda --------------------
  { name: 'Tambacounda', aliases: ['Tambacounda', 'Tamba'], region: 'Tambacounda', latitude: 13.7689, longitude: -13.6672 },
  { name: 'Bakel', aliases: ['Bakel'], region: 'Tambacounda', latitude: 14.9, longitude: -12.4592 },
  { name: 'Goudiry', aliases: ['Goudiry', 'Goudonp'], region: 'Tambacounda', latitude: 14.1833, longitude: -12.7167 },
  { name: 'Koumpentoum', aliases: ['Koumpentoum'], region: 'Tambacounda', latitude: 13.9833, longitude: -14.55 },

  // -------------------- Région de Kolda --------------------
  { name: 'Kolda', aliases: ['Kolda'], region: 'Kolda', latitude: 12.8833, longitude: -14.95 },
  { name: 'Vélingara', aliases: ['Vélingara', 'Velingara'], region: 'Kolda', latitude: 13.15, longitude: -14.1167 },
  { name: 'Médina Yoro Foulah', aliases: ['Médina Yoro Foulah', 'Medina Yoro Foulah'], region: 'Kolda', latitude: 13.0167, longitude: -14.7333 },

  // -------------------- Région de Kaffrine --------------------
  { name: 'Kaffrine', aliases: ['Kaffrine'], region: 'Kaffrine', latitude: 14.105, longitude: -15.55 },
  { name: 'Birkilane', aliases: ['Birkilane'], region: 'Kaffrine', latitude: 14.1167, longitude: -15.75 },
  { name: 'Koungheul', aliases: ['Koungheul'], region: 'Kaffrine', latitude: 13.9833, longitude: -14.8 },
  { name: 'Malem Hodar', aliases: ['Malem Hodar', 'Malem-Hodar'], region: 'Kaffrine', latitude: 14.0833, longitude: -15.3167 },

  // -------------------- Région de Kédougou --------------------
  { name: 'Kédougou', aliases: ['Kédougou', 'Kedougou'], region: 'Kédougou', latitude: 12.5556, longitude: -12.1747 },
  { name: 'Salémata', aliases: ['Salémata', 'Salemata'], region: 'Kédougou', latitude: 12.6333, longitude: -12.8167 },
  { name: 'Saraya', aliases: ['Saraya'], region: 'Kédougou', latitude: 12.85, longitude: -11.7833 },

  // -------------------- Région de Sédhiou --------------------
  { name: 'Sédhiou', aliases: ['Sédhiou', 'Sedhiou'], region: 'Sédhiou', latitude: 12.7081, longitude: -15.5569 },
  { name: 'Bounkiling', aliases: ['Bounkiling'], region: 'Sédhiou', latitude: 13.0394, longitude: -15.7039 },
  { name: 'Goudomp', aliases: ['Goudomp'], region: 'Sédhiou', latitude: 12.5828, longitude: -15.8767 },

  // -------------------- Région de Fatick --------------------
  { name: 'Fatick', aliases: ['Fatick'], region: 'Fatick', latitude: 14.3344, longitude: -16.4072 },
  { name: 'Foundiougne', aliases: ['Foundiougne'], region: 'Fatick', latitude: 14.1331, longitude: -16.4667 },
  { name: 'Gossas', aliases: ['Gossas'], region: 'Fatick', latitude: 14.4928, longitude: -16.0608 },
  { name: 'Sokone', aliases: ['Sokone'], region: 'Fatick', latitude: 13.8794, longitude: -16.3675 },
  { name: 'Passy', aliases: ['Passy'], region: 'Fatick', latitude: 13.9, longitude: -16.2333 },

  // -------------------- Région de Louga --------------------
  { name: 'Louga', aliases: ['Louga'], region: 'Louga', latitude: 15.6189, longitude: -16.2244 },
  { name: 'Kébémer', aliases: ['Kébémer', 'Kebemer'], region: 'Louga', latitude: 15.3683, longitude: -16.4475 },
  { name: 'Linguère', aliases: ['Linguère', 'Linguere'], region: 'Louga', latitude: 15.3925, longitude: -15.1156 },
  { name: 'Dahra', aliases: ['Dahra'], region: 'Louga', latitude: 15.3433, longitude: -15.4783 },

  // -------------------- Région de Matam --------------------
  { name: 'Matam', aliases: ['Matam'], region: 'Matam', latitude: 15.6558, longitude: -13.255 },
  { name: 'Kanel', aliases: ['Kanel'], region: 'Matam', latitude: 15.4969, longitude: -13.1772 },
  { name: 'Ranérou', aliases: ['Ranérou', 'Ranerou'], region: 'Matam', latitude: 15.3, longitude: -13.95 },
  { name: 'Ourossogui', aliases: ['Ourossogui'], region: 'Matam', latitude: 15.6053, longitude: -13.3197 },
];

/**
 * Supprime accents, met en minuscules et normalise les espaces — utilisé pour
 * comparer les noms de localités quel que soit l'orthographe d'entrée.
 */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritiques combinants (NFD)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tente de retrouver une entrée du gazetteer pour la chaîne fournie.
 *
 * Stratégie :
 *   1. Match exact sur un alias normalisé
 *   2. Sinon, recherche par inclusion : on garde le match le plus long
 *      (évite que "Kaolack" soit confondu avec "Kao" ou similaire)
 *
 * @returns L'entrée gazetteer, ou null si rien ne correspond.
 */
export function geocodeLocalite(input: string | null | undefined): GazetteerEntry | null {
  if (!input) return null;
  const needle = normalize(input);
  if (!needle) return null;

  // 1) Match exact (alias entier === needle)
  for (const entry of GAZETTEER) {
    for (const alias of entry.aliases) {
      if (normalize(alias) === needle) return entry;
    }
  }

  // 2) Match par inclusion — garde l'alias le plus long pour éviter les
  //    faux positifs (ex: "Goudiry" plus long que "Diry").
  let best: { entry: GazetteerEntry; aliasLen: number } | null = null;
  for (const entry of GAZETTEER) {
    for (const alias of entry.aliases) {
      const aliasNorm = normalize(alias);
      if (aliasNorm.length < 4) continue; // ignore les trop courts (ex: "Pout")
      if (needle.includes(aliasNorm)) {
        if (!best || aliasNorm.length > best.aliasLen) {
          best = { entry, aliasLen: aliasNorm.length };
        }
      }
    }
  }
  return best ? best.entry : null;
}

/**
 * Variante typée : retourne uniquement les coordonnées + la région, prêtes à
 * être insérées dans `missionsTerrain` (ou autre table avec lat/lng/région).
 */
export function geocode(
  input: string | null | undefined,
): { latitude: number; longitude: number; region: string } | null {
  const entry = geocodeLocalite(input);
  if (!entry) return null;
  return { latitude: entry.latitude, longitude: entry.longitude, region: entry.region };
}

/** Liste exposée pour tests / debug. */
export const SENEGAL_GAZETTEER: readonly GazetteerEntry[] = GAZETTEER;
