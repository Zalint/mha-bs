import { Router } from 'express';
import { z } from 'zod';

import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import { logger } from '../../lib/logger.js';
import { wipeDatabase } from '../../services/wipeService.js';

export const adminRoutes = Router();

// Toutes les routes admin nécessitent JWT + rôle admin.
adminRoutes.use(authJwt, requireRole('admin'));

/**
 * POST /api/admin/wipe-database
 *
 * Vide les tables transactionnelles. Pour éviter un déclenchement accidentel,
 * le client DOIT envoyer { confirmation: "VIDER" } dans le body.
 *
 * ⚠️ Action destructive irréversible. Le frontend télécharge automatiquement
 * un backup complet (export 'all') AVANT d'appeler cette route.
 */
const wipeBodySchema = z.object({
  confirmation: z.literal('VIDER', {
    errorMap: () => ({ message: 'Le champ "confirmation" doit valoir exactement "VIDER".' }),
  }),
});

adminRoutes.post('/wipe-database', validate(wipeBodySchema), async (req, res, next) => {
  try {
    const userId = req.user?.userId ?? 'inconnu';
    logger.warn({ userId }, '⚠️ WIPE DATABASE déclenché');

    const result = await wipeDatabase();

    logger.warn(
      { userId, totalDeleted: result.totalDeleted, before: result.before },
      `WIPE DATABASE terminé · ${result.totalDeleted} lignes supprimées`,
    );

    res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});
