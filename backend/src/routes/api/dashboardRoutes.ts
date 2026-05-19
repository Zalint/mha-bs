import { Router } from 'express';
import { z } from 'zod';

import { TYPES_RENCONTRE } from '@mha-bs/shared';

import { queryAll } from '../../db/query.js';
import { authJwt } from '../../middlewares/authJwt.js';
import { validate } from '../../middlewares/validate.js';
import {
  getEvolutionMensuelle,
  getGlobalKpis,
  getKpisByTypeRencontre,
  getStatsByDirection,
  getStatsByType,
  getTopRetards,
} from '../../services/dashboardService.js';

export const dashboardRoutes = Router();

dashboardRoutes.get('/global', authJwt, async (_req, res, next) => {
  try {
    const [kpis, statsByType, evolution, topRetards, byDirection] = await Promise.all([
      getGlobalKpis(),
      getStatsByType(),
      getEvolutionMensuelle(),
      getTopRetards(5),
      getStatsByDirection(),
    ]);
    res.json({ kpis, statsByType, evolution, topRetards, byDirection });
  } catch (err) {
    next(err);
  }
});

const kpisQuerySchema = z.object({
  typeRencontre: z.enum(TYPES_RENCONTRE).optional(),
});

dashboardRoutes.get('/kpis', authJwt, validate(kpisQuerySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.query as z.infer<typeof kpisQuerySchema>;
    const kpis = q.typeRencontre
      ? await getKpisByTypeRencontre(q.typeRencontre)
      : await getGlobalKpis();
    res.json(kpis);
  } catch (err) {
    next(err);
  }
});

dashboardRoutes.get('/par-direction', authJwt, async (_req, res, next) => {
  try {
    res.json({ items: await getStatsByDirection() });
  } catch (err) {
    next(err);
  }
});

dashboardRoutes.get('/top-retards', authJwt, async (_req, res, next) => {
  try {
    res.json({ items: await getTopRetards(10) });
  } catch (err) {
    next(err);
  }
});

/**
 * Compteurs utilises par la sidebar — un seul roundtrip pour tous les badges.
 * Renvoie 0 si la table est vide (pas d'erreur, pas de cle absente).
 */
dashboardRoutes.get('/nav-counts', authJwt, async (_req, res, next) => {
  try {
    const [directives, matrices, reunions, missions, interpellations] = await Promise.all([
      queryAll<{ typeRencontre: string; n: string }>(
        `SELECT r."typeRencontre", COUNT(*)::TEXT AS "n"
         FROM "directives" d
         LEFT JOIN "rencontres" r ON r."id" = d."rencontreId"
         WHERE r."typeRencontre" IS NOT NULL
         GROUP BY r."typeRencontre"`,
      ),
      queryAll<{ typeMatrice: string; n: string }>(
        `SELECT "typeMatrice", COUNT(*)::TEXT AS "n"
         FROM "recommandationsMatrice"
         GROUP BY "typeMatrice"`,
      ),
      queryAll<{ n: string }>(`SELECT COUNT(*)::TEXT AS "n" FROM "reunionsTechniques"`),
      queryAll<{ n: string }>(`SELECT COUNT(*)::TEXT AS "n" FROM "missionsTerrain"`),
      queryAll<{ n: string }>(`SELECT COUNT(*)::TEXT AS "n" FROM "interpellations"`),
    ]);

    const directivesByType: Record<string, number> = {};
    for (const r of directives) directivesByType[r.typeRencontre] = Number(r.n);

    const matricesByType: Record<string, number> = {};
    for (const r of matrices) matricesByType[r.typeMatrice] = Number(r.n);

    const sumStartingWith = (prefix: string): number =>
      Object.entries(matricesByType)
        .filter(([k]) => k.toLowerCase().startsWith(prefix))
        .reduce((acc, [, v]) => acc + v, 0);

    res.json({
      directives: {
        conseilInterMinisteriel: directivesByType.conseilInterMinisteriel ?? 0,
        conseilMinistres: directivesByType.conseilMinistres ?? 0,
        coordinationSggSg: directivesByType.coordinationSggSg ?? 0,
      },
      recommandations: {
        copil: sumStartingWith('copil'),
        reformes: sumStartingWith('reforme'),
        cngi: matricesByType.cngi ?? 0,
      },
      reunionsTechniques: Number(reunions[0]?.n ?? 0),
      missionsTerrain: Number(missions[0]?.n ?? 0),
      interpellations: Number(interpellations[0]?.n ?? 0),
    });
  } catch (err) {
    next(err);
  }
});
