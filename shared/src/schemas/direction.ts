import { z } from 'zod';

export const directionSchema = z.object({
  id: z.number().int().positive(),
  code: z.string().min(2).max(20),
  fullName: z.string().min(2).max(200),
  typeEntite: z.enum(['direction', 'office', 'agence', 'societe', 'autre']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  ordreAffichage: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Direction = z.infer<typeof directionSchema>;
