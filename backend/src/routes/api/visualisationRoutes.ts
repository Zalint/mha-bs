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
  getExplorerSchema,
  runQuery,
  runRows,
} from '../../services/explorerService.js';
import {
  getDirectivesVisualisations,
  getRecommandationsVisualisations,
} from '../../services/visualisationService.js';

export const visualisationRoutes = Router();

// ===========================================================================
// EXPLORER (mode Power BI) — moteur de requête générique
// ===========================================================================

/** GET /api/visualisations/explorer/schema — sources/dimensions/mesures/filtres. */
visualisationRoutes.get('/explorer/schema', authJwt, (_req, res, next) => {
  try {
    res.json({ sources: getExplorerSchema() });
  } catch (err) {
    next(err);
  }
});

const filterSchema = z.object({
  key: z.string(),
  values: z.array(z.union([z.string(), z.number()])).max(50),
});

const querySchema = z.object({
  source: z.string(),
  dimensions: z.array(z.string()).max(2).default([]),
  measure: z.string(),
  filters: z.array(filterSchema).max(20).default([]),
  limit: z.number().int().positive().max(500).optional(),
});

/** POST /api/visualisations/explorer/query — agrégation group-by. */
visualisationRoutes.post(
  '/explorer/query',
  authJwt,
  validate(querySchema),
  async (req, res, next) => {
    try {
      const spec = req.body as z.infer<typeof querySchema>;
      res.json(await runQuery(spec));
    } catch (err) {
      next(err);
    }
  },
);

const rowsSchema = z.object({
  source: z.string(),
  filters: z.array(filterSchema).max(20).default([]),
  limit: z.number().int().positive().max(300).optional(),
});

/** POST /api/visualisations/explorer/rows — lignes brutes (drill-down). */
visualisationRoutes.post(
  '/explorer/rows',
  authJwt,
  validate(rowsSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof rowsSchema>;
      res.json(await runRows(body.source, body.filters, body.limit));
    } catch (err) {
      next(err);
    }
  },
);

const directivesQuerySchema = z.object({
  annee: z.coerce.number().int().min(2000).max(2100).optional(),
  anneeMode: z.enum(ANNEE_MODES).default('active'),
  typeRencontre: z.enum(TYPES_RENCONTRE).optional(),
  creeEnAnneeOnly: z.coerce.boolean().default(false),
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
          creeEnAnneeOnly: q.creeEnAnneeOnly,
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
