/**
 * Constantes métier partagées backend/frontend.
 * Le format de date est imposé : YYYY-MM-DD partout.
 */

export const DATE_FORMAT = 'YYYY-MM-DD' as const;
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const USER_ROLES = ['admin', 'bs', 'reader'] as const;
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
