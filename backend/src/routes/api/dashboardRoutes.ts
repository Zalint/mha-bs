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
  getSgSummary,
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
  annee: z.coerce.number().int().min(2000).max(2100).optional(),
});

dashboardRoutes.get('/kpis', authJwt, validate(kpisQuerySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof kpisQuerySchema>;
    const kpis = q.typeRencontre
      ? await getKpisByTypeRencontre(q.typeRencontre, q.annee)
      : await getGlobalKpis();
    res.json(kpis);
  } catch (err) {
    next(err);
  }
});

const sgSummaryQuerySchema = z.object({
  annee: z.coerce.number().int().min(2000).max(2100).optional(),
});

dashboardRoutes.get(
  '/sg-summary',
  authJwt,
  validate(sgSummaryQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof sgSummaryQuerySchema>;
      res.json(await getSgSummary(q.annee));
    } catch (err) {
      next(err);
    }
  },
);

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
    const [directives, matrices, matriceCategories, reunions, missions, interpellations] = await Promise.all([
      queryAll<{ typeRencontre: string; n: string }>(
        `SELECT r."typeRencontre", COUNT(*)::TEXT AS "n"
         FROM "directives" d
         LEFT JOIN "rencontres" r ON r."id" = d."rencontreId"
         WHERE r."typeRencontre" IS NOT NULL
         GROUP BY r."typeRencontre"`,
      ),
      // Compte les recommandations par typeMatrice + cle vers parentCode de la matrice
      queryAll<{ typeMatrice: string; parentCode: string | null; n: string }>(
        `SELECT m."typeMatrice",
                r."parentCode",
                COUNT(*)::TEXT AS "n"
         FROM "recommandationsMatrice" m
         LEFT JOIN "referentiels" r
           ON r."codeType" = 'typeMatrice' AND r."code" = m."typeMatrice"
         GROUP BY m."typeMatrice", r."parentCode"`,
      ),
      // Liste des categories de matrice (pour exposer aussi celles a 0 reco)
      queryAll<{ code: string }>(
        `SELECT "code" FROM "referentiels"
         WHERE "codeType" = 'matriceCategorie' AND "isActive" = TRUE`,
      ),
      queryAll<{ n: string }>(`SELECT COUNT(*)::TEXT AS "n" FROM "reunionsTechniques"`),
      queryAll<{ n: string }>(`SELECT COUNT(*)::TEXT AS "n" FROM "missionsTerrain"`),
      queryAll<{ n: string }>(`SELECT COUNT(*)::TEXT AS "n" FROM "interpellations"`),
    ]);

    const directivesByType: Record<string, number> = {};
    for (const r of directives) directivesByType[r.typeRencontre] = Number(r.n);

    // Compte les recommandations par categorie (via parentCode de la matrice).
    // Si la matrice n'a pas de parentCode => bucket 'autres'.
    const recommandationsByCategory: Record<string, number> = {};
    for (const c of matriceCategories) recommandationsByCategory[c.code] = 0;
    if (!recommandationsByCategory.autres) recommandationsByCategory.autres = 0;
    for (const m of matrices) {
      const cat = m.parentCode ?? 'autres';
      recommandationsByCategory[cat] = (recommandationsByCategory[cat] ?? 0) + Number(m.n);
    }

    res.json({
      directives: {
        conseilInterMinisteriel: directivesByType.conseilInterMinisteriel ?? 0,
        conseilMinistres: directivesByType.conseilMinistres ?? 0,
        coordinationSggSg: directivesByType.coordinationSggSg ?? 0,
      },
      // Compteurs par categorie de matrice (driven by parentCode)
      // Cles : 'copil', 'reformes', 'cngi', 'autres' + toute nouvelle categorie creee
      recommandations: recommandationsByCategory,
      reunionsTechniques: Number(reunions[0]?.n ?? 0),
      missionsTerrain: Number(missions[0]?.n ?? 0),
      interpellations: Number(interpellations[0]?.n ?? 0),
    });
  } catch (err) {
    next(err);
  }
});
