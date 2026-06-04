/**
 * Routes pour le module Visualisations (page /visualisations).
 * 2 endpoints :
 *   - GET /api/visualisations/directives?annee=&anneeMode=&typeRencontre=
 *   - GET /api/visualisations/recommandations
 *
 * Pas de filtre sur recommandations pour le moment — la table n'a pas
 * d'année métier signifiante.
 */

import { Router } from 'express';
import { z } from 'zod';

import { ANNEE_MODES, TYPES_RENCONTRE } from '@mha-bs/shared';

import { authJwt } from '../../middlewares/authJwt.js';
import { validate } from '../../middlewares/validate.js';
import {
  getDirectivesVisualisations,
  getRecommandationsVisualisations,
} from '../../services/visualisationService.js';

export const visualisationRoutes = Router();

const directivesQuerySchema = z.object({
  annee: z.coerce.number().int().min(2000).max(2100).optional(),
  anneeMode: z.enum(ANNEE_MODES).default('active'),
  typeRencontre: z.enum(TYPES_RENCONTRE).optional(),
});

visualisationRoutes.get(
  '/directives',
  authJwt,
  validate(directivesQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof directivesQuerySchema>;
      res.json(
        await getDirectivesVisualisations({
          annee: q.annee,
          anneeMode: q.anneeMode,
          typeRencontre: q.typeRencontre,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

visualisationRoutes.get('/recommandations', authJwt, async (_req, res, next) => {
  try {
    res.json(await getRecommandationsVisualisations());
  } catch (err) {
    next(err);
  }
});
