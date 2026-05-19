import { z } from 'zod';

import { DATE_REGEX, REGIONS_SENEGAL } from '../constants.js';

const dateString = z.string().regex(DATE_REGEX, 'Format date attendu YYYY-MM-DD');

export const ouvrageVisiteSchema = z.object({
  id: z.string().uuid(),
  missionId: z.string().uuid(),
  nomOuvrage: z.string().min(2),
  typeOuvrage: z.string().nullable(),
  etatOuvrage: z.enum(['fonctionnel', 'maintenance', 'horsService', 'enConstruction']),
  observations: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type OuvrageVisite = z.infer<typeof ouvrageVisiteSchema>;

export const missionTerrainSchema = z.object({
  id: z.string().uuid(),
  dateMission: dateString,
  localite: z.string().min(2),
  region: z.enum(REGIONS_SENEGAL).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  projetRattache: z.string().nullable(),
  constats: z.string().nullable(),
  recommandations: z.string().nullable(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MissionTerrain = z.infer<typeof missionTerrainSchema>;

export const createMissionTerrainSchema = missionTerrainSchema.omit({
  id: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateMissionTerrainInput = z.infer<typeof createMissionTerrainSchema>;
