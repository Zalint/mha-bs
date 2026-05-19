import { Router } from 'express';

import { directiveFiltersSchema } from '@mha-bs/shared';

import { validate } from '../../middlewares/validate.js';
import { listDirectives } from '../../models/directiveModel.js';
import { getGlobalKpis } from '../../services/dashboardService.js';

/**
 * API externe (x-api-key) - lecture seule.
 * Meme logique métier que l'API interne, mais sans JWT et avec un préfixe différent.
 */
export const externalDirectiveRoutes = Router();

externalDirectiveRoutes.get('/', validate(directiveFiltersSchema, 'query'), async (req, res, next) => {
  try {
    const result = await listDirectives(req.query as never);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

externalDirectiveRoutes.get('/dashboard/kpis', async (_req, res, next) => {
  try {
    res.json(await getGlobalKpis());
  } catch (err) {
    next(err);
  }
});
