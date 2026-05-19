import { z } from 'zod';

import { DATE_REGEX, SOUS_SECTEURS } from '../constants.js';

const dateString = z.string().regex(DATE_REGEX, 'Format date attendu YYYY-MM-DD');
const timeString = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Format heure attendu HH:MM');

export const reunionTechniqueSchema = z.object({
  id: z.string().uuid(),
  dateReunion: dateString,
  heureDebut: timeString.nullable(),
  dureeEstimee: z.string().nullable(),
  theme: z.string().min(3),
  lieu: z.string().nullable(),
  sousSecteur: z.enum(SOUS_SECTEURS).nullable(),
  copilLie: z.string().nullable(),
  ordreDuJour: z.string().nullable(),
  decisions: z.string().nullable(),
  participants: z.array(z.string()),
  visibleSg: z.boolean(),
  inclusRapportHebdo: z.boolean(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReunionTechnique = z.infer<typeof reunionTechniqueSchema>;

export const createReunionTechniqueSchema = reunionTechniqueSchema.omit({
  id: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateReunionTechniqueInput = z.infer<typeof createReunionTechniqueSchema>;
