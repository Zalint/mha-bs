import { Router } from 'express';
import { z } from 'zod';

import { authJwt } from '../../middlewares/authJwt.js';
import { validate } from '../../middlewares/validate.js';
import { buildExportWorkbook, type ExportScope } from '../../services/excelExportService.js';

export const exportRoutes = Router();

const scopeSchema = z.object({
  scope: z.enum(['all', 'directives', 'recommandations', 'activite']).default('all'),
});

/**
 * GET /api/export?scope=all|directives|recommandations|activite
 * Renvoie un fichier .xlsx binaire au format historique (6 onglets pour 'all') :
 *   PLAN, Suivi Recom Copil, Suivi Recom CNGI, Réf sur l'ASS,
 *   Sui FeuilleR Ref Inst, Suivi Rtechnique.
 * Directement réimportable via /api/import.
 */
exportRoutes.get('/', authJwt, validate(scopeSchema, 'query'), async (req, res, next) => {
  try {
    const q = req.query as unknown as { scope: ExportScope };
    const { buffer, filename } = await buildExportWorkbook(q.scope);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});
