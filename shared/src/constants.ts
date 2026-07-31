/**
 * Constantes métier partagées backend/frontend.
 * Le format de date est imposé : YYYY-MM-DD partout.
 */

export const DATE_FORMAT = 'YYYY-MM-DD' as const;
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const USER_ROLES = ['admin', 'sg', 'bs', 'reader'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const DIRECTIVE_ETATS = ['attente', 'enCours', 'realisee', 'ineligible'] as const;
export type DirectiveEtat = (typeof DIRECTIVE_ETATS)[number];

export const STATUTS_VALIDATION = ['brouillon', 'soumis', 'valide'] as const;
export type StatutValidation = (typeof STATUTS_VALIDATION)[number];

export const TYPES_RENCONTRE = [
  'conseilMinistres',
  'conseilInterMinisteriel',
  'coordinationSggSg',
  'copil',
  'cngi',
  'reunionTechnique',
  'commissionAn',
] as const;
export type TypeRencontre = (typeof TYPES_RENCONTRE)[number];

export const TYPES_MATRICE = [
  'copilProgepIi',
  'copilPisea',
  'copilPaseaRd',
  'copilPdbh',
  'copilPromoren',
  'reformeAssainissement',
  'reformeInstitutionnelle',
  'cngi',
] as const;
export type TypeMatrice = (typeof TYPES_MATRICE)[number];

export const SOUS_SECTEURS = [
  'eau',
  'gire',
  'assainissement',
  'inondations',
  'transversal',
  'reformeInstitutionnelle',
] as const;
export type SousSecteur = (typeof SOUS_SECTEURS)[number];

export const TYPES_INTERPELLATION = ['orale', 'ecrite', 'commission'] as const;
export type TypeInterpellation = (typeof TYPES_INTERPELLATION)[number];

export const ETATS_INTERPELLATION = ['recue', 'enPreparation', 'aValider', 'repondue'] as const;
export type EtatInterpellation = (typeof ETATS_INTERPELLATION)[number];

export const GROUPES_PARLEMENTAIRES = ['Pastef', 'BBY', 'Yewwi', 'Wallu', 'NI'] as const;
export type GroupeParlementaire = (typeof GROUPES_PARLEMENTAIRES)[number];

export const CATEGORIES_ALERTE = ['critique', 'warning', 'info'] as const;
export type CategorieAlerte = (typeof CATEGORIES_ALERTE)[number];

export const REGIONS_SENEGAL = [
  'Dakar',
  'Thiès',
  'Diourbel',
  'Saint-Louis',
  'Kaolack',
  'Ziguinchor',
  'Tambacounda',
  'Kolda',
  'Kaffrine',
  'Kédougou',
  'Sédhiou',
  'Fatick',
  'Louga',
  'Matam',
] as const;
export type RegionSenegal = (typeof REGIONS_SENEGAL)[number];

/**
 * Coordonnées du chef-lieu de chaque région (point de repli fixe et connu).
 * Utilisé pour placer une localité de mission qui n'a pas de GPS saisi : le
 * marqueur retombe alors sur le centre de sa région plutôt que de disparaître.
 * Appliqué au rendu (et non stocké) : changer la région d'une mission met donc
 * à jour le repli sans réécriture.
 */
export const REGION_CENTROIDS: Record<RegionSenegal, { latitude: number; longitude: number }> = {
  Dakar: { latitude: 14.6928, longitude: -17.4467 },
  Thiès: { latitude: 14.7833, longitude: -16.9167 },
  Diourbel: { latitude: 14.6556, longitude: -16.2314 },
  'Saint-Louis': { latitude: 16.0326, longitude: -16.4818 },
  Kaolack: { latitude: 14.1652, longitude: -16.0757 },
  Ziguinchor: { latitude: 12.5641, longitude: -16.2639 },
  Tambacounda: { latitude: 13.7708, longitude: -13.6673 },
  Kolda: { latitude: 12.8983, longitude: -14.9412 },
  Kaffrine: { latitude: 14.1059, longitude: -15.5416 },
  Kédougou: { latitude: 12.5556, longitude: -12.1747 },
  Sédhiou: { latitude: 12.7081, longitude: -15.5569 },
  Fatick: { latitude: 14.3344, longitude: -16.4072 },
  Louga: { latitude: 15.6189, longitude: -16.2244 },
  Matam: { latitude: 15.6558, longitude: -13.2554 },
};
