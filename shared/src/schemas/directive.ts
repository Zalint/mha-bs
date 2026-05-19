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

export const directiveFiltersSchema = z.object({
  typeRencontre: z.string().optional(),
  etat: z.enum(DIRECTIVE_ETATS).optional(),
  statutValidation: z.enum(STATUTS_VALIDATION).optional(),
  annee: z.coerce.number().int().optional(),
  rencontreId: z.string().uuid().optional(),
  responsableId: z.coerce.number().int().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export type DirectiveFilters = z.infer<typeof directiveFiltersSchema>;
