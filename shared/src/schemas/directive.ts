import { z } from 'zod';

import { DATE_REGEX, DIRECTIVE_ETATS, STATUTS_VALIDATION } from '../constants.js';

const dateString = z.string().regex(DATE_REGEX, 'Format date attendu YYYY-MM-DD');

export const directiveSchema = z.object({
  id: z.string().uuid(),
  rencontreId: z.string().uuid(),
  codeDirective: z.string().min(3).max(50),
  texteDirective: z.string().min(3),
  responsableId: z.number().int().positive().nullable(),
  ministeresAssocies: z.array(z.string()),
  echeance: dateString.nullable(),
  debutExecution: dateString.nullable(),
  finExecution: dateString.nullable(),
  etat: z.enum(DIRECTIVE_ETATS),
  typeCause: z.string().nullable(),
  joursPrevu: z.number().int().nullable(),
  joursReel: z.number().int().nullable(),
  joursRetardDemarrage: z.number().int().nullable(),
  derniereDateTraitement: dateString.nullable(),
  commentaires: z.string().nullable(),
  statutValidation: z.enum(STATUTS_VALIDATION),
  validatedAt: z.string().datetime().nullable(),
  validatedBy: z.string().uuid().nullable(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Directive = z.infer<typeof directiveSchema>;

export const createDirectiveSchema = directiveSchema.omit({
  id: true,
  statutValidation: true,
  validatedAt: true,
  validatedBy: true,
  createdBy: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
  joursPrevu: true,
  joursReel: true,
  joursRetardDemarrage: true,
  derniereDateTraitement: true,
});
export type CreateDirectiveInput = z.infer<typeof createDirectiveSchema>;

export const updateDirectiveSchema = createDirectiveSchema.partial();
export type UpdateDirectiveInput = z.infer<typeof updateDirectiveSchema>;

/**
 * Sémantique du filtre par année. Utilisé par la liste des directives et
 * les KPIs du dashboard. Détermine comment "année = N" est interprété :
 *   - 'active'   : la directive est active pendant N (émise pendant/avant N
 *                  ET non close début N). Gère les pluri-annuelles.
 *   - 'creation' : la directive a été émise en N (rencontre.annee = N).
 *   - 'echeance' : l'échéance de la directive tombe en N
 *                  (year(echeance) = N). Exclut les directives sans échéance.
 */
export const ANNEE_MODES = ['active', 'creation', 'echeance'] as const;
export type AnneeMode = (typeof ANNEE_MODES)[number];

export const directiveFiltersSchema = z.object({
  typeRencontre: z.string().optional(),
  etat: z.enum(DIRECTIVE_ETATS).optional(),
  statutValidation: z.enum(STATUTS_VALIDATION).optional(),
  annee: z.coerce.number().int().optional(),
  anneeMode: z.enum(ANNEE_MODES).default('active'),
  /**
   * 2e layer : si true, ajoute la contrainte "créée dans l'année sélectionnée"
   * (r.annee = annee) au filtre principal. Combine bien avec anneeMode='active'
   * pour voir "créées en N ET toujours ouvertes en N".
   * Ignoré si annee n'est pas définie.
   */
  creeEnAnneeOnly: z.coerce.boolean().default(false),
  rencontreId: z.string().uuid().optional(),
  responsableId: z.coerce.number().int().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(1000).default(50),
});
export type DirectiveFilters = z.infer<typeof directiveFiltersSchema>;
