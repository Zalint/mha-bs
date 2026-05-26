import { z } from 'zod';

import { DIRECTIVE_ETATS } from '../constants.js';

export const recommandationMatriceSchema = z.object({
  id: z.string().uuid(),
  // typeMatrice est extensible via /bs/config (referentiel "typeMatrice")
  typeMatrice: z.string().min(1).max(50),
  numOrdre: z.number().int().positive(),
  texteRecommandation: z.string().min(3),
  etat: z.enum(DIRECTIVE_ETATS),
  observations: z.string().nullable(),
  echeanceTrimestre: z.enum(['T1', 'T2', 'T3', 'T4']).nullable(),
  priorite: z.enum(['urgent', 'prioritaire', 'obligatoire', 'standard']).nullable(),
  responsableId: z.number().int().positive().nullable(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type RecommandationMatrice = z.infer<typeof recommandationMatriceSchema>;

export const updateRecommandationMatriceSchema = recommandationMatriceSchema
  .pick({ etat: true, observations: true, echeanceTrimestre: true, priorite: true })
  .partial();
export type UpdateRecommandationMatriceInput = z.infer<typeof updateRecommandationMatriceSchema>;

/**
 * Création d'une nouvelle recommandation matrice.
 * numOrdre est auto-calculé (MAX+1 pour le typeMatrice) côté serveur,
 * donc absent de l'input.
 */
export const createRecommandationMatriceSchema = z.object({
  typeMatrice: z.string().min(1).max(50),
  texteRecommandation: z.string().min(3),
  echeanceTrimestre: z.enum(['T1', 'T2', 'T3', 'T4']).nullable().optional(),
  priorite: z.enum(['urgent', 'prioritaire', 'obligatoire', 'standard']).nullable().optional(),
  observations: z.string().nullable().optional(),
});
export type CreateRecommandationMatriceInput = z.infer<typeof createRecommandationMatriceSchema>;
