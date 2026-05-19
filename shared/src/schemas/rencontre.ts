import { z } from 'zod';

import { DATE_REGEX } from '../constants.js';

export const rencontreSchema = z.object({
  id: z.string().uuid(),
  // typeRencontre est extensible via /bs/config (referentiel "typeRencontre")
  typeRencontre: z.string().min(1).max(50),
  codeRencontre: z.string().min(3).max(50),
  intitule: z.string().min(3),
  dateRencontre: z.string().regex(DATE_REGEX, 'Format date attendu YYYY-MM-DD'),
  annee: z.number().int().gte(2020).lte(2100),
  copilName: z.string().nullable(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Rencontre = z.infer<typeof rencontreSchema>;

export const createRencontreSchema = rencontreSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});
export type CreateRencontreInput = z.infer<typeof createRencontreSchema>;
