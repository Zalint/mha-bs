import { Router } from 'express';
import { z } from 'zod';

import { authJwt } from '../../middlewares/authJwt.js';
import { validate } from '../../middlewares/validate.js';
import { buildExportWorkbook, type ExportScope } from '../../services/excelExportService.js';

export const exportRoutes = Router();

const scopeSchema = z.object({
  scope: z.enum(['all', 'directives', 'recommandations', 'activite', 'projets']).default('all'),
});

/**
 * GET /api/export?scope=all|directives|recommandations|activite|projets
 * Renvoie un fichier .xlsx binaire avec les données demandées.
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
