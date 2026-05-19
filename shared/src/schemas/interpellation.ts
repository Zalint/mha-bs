import { z } from 'zod';

import { DATE_REGEX } from '../constants.js';

const dateString = z.string().regex(DATE_REGEX, 'Format date attendu YYYY-MM-DD');

export const deputeSchema = z.object({
  id: z.string().uuid(),
  nomComplet: z.string().min(2).max(150),
  sexe: z.enum(['M', 'F']).nullable(),
  // groupeParlementaire est extensible via /bs/config (referentiel "groupeParlementaire")
  groupeParlementaire: z.string().min(1).max(50),
  region: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Depute = z.infer<typeof deputeSchema>;

export const sessionParlementaireSchema = z.object({
  id: z.string().uuid(),
  intitule: z.string().min(3).max(150),
  typeSession: z.enum(['ordinaire', 'budgetaire', 'extraordinaire']),
  dateDebut: dateString,
  dateFin: dateString.nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SessionParlementaire = z.infer<typeof sessionParlementaireSchema>;

export const interpellationSchema = z.object({
  id: z.string().uuid(),
  reference: z.string().min(3).max(30),
  deputeId: z.string().uuid(),
  sessionId: z.string().uuid().nullable(),
  titre: z.string().min(3),
  description: z.string().nullable(),
  // typeInterpellation est extensible via /bs/config (referentiel "typeInterpellation")
  typeInterpellation: z.string().min(1).max(40),
  dateReception: dateString,
  echeanceReponse: dateString.nullable(),
  dateReponse: dateString.nullable(),
  // etat est extensible via /bs/config (referentiel "etatInterpellation")
  etat: z.string().min(1).max(30),
  texteReponse: z.string().nullable(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Interpellation = z.infer<typeof interpellationSchema>;

export const createInterpellationSchema = interpellationSchema.omit({
  id: true,
  createdBy: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
  dateReponse: true,
  texteReponse: true,
  etat: true,
});
export type CreateInterpellationInput = z.infer<typeof createInterpellationSchema>;
