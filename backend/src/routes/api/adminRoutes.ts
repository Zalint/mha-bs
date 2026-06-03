import * as crypto from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import { ForbiddenError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import { backfillMissionsGeocoding } from '../../services/geocodingService.js';
import { wipeDatabase } from '../../services/wipeService.js';

/**
 * Hash SHA-256 du code secret requis pour valider un wipe.
 * Le code en clair n'apparaît JAMAIS dans le code source — seul son hash.
 * Pour changer le code : exécuter `node -e "console.log(require('crypto')
 * .createHash('sha256').update('NouveauCode').digest('hex'))"` et remplacer.
 */
const WIPE_SECRET_HASH = '456d930e0fe0fd01afa3c3c8ea3843b4c9943ae04b956910f5d113e75fb309fc';

function isValidWipeCode(plaintext: string): boolean {
  const hash = crypto.createHash('sha256').update(plaintext).digest('hex');
  // Comparaison en temps constant pour éviter les attaques par timing
  if (hash.length !== WIPE_SECRET_HASH.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(WIPE_SECRET_HASH));
}

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
  code: z.string().min(1, 'Le code de sécurité est requis.'),
});

adminRoutes.post('/wipe-database', validate(wipeBodySchema), async (req, res, next) => {
  try {
    const userId = req.user?.userId ?? 'inconnu';
    const { code } = req.body as z.infer<typeof wipeBodySchema>;

    // === Validation du code de sécurité ===
    if (!isValidWipeCode(code)) {
      logger.warn({ userId }, '🛡  WIPE DATABASE rejeté — code de sécurité invalide');
      throw new ForbiddenError(
        'Code de sécurité invalide. Contactez votre administrateur référent.',
      );
    }

    logger.warn({ userId }, '⚠️ WIPE DATABASE déclenché (code valide)');

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

/**
 * POST /api/admin/backfill-geocoding
 *
 * Parcourt les missions terrain dont latitude/longitude/region sont NULL
 * et tente de les compléter via le gazetteer Sénégal (données embarquées,
 * aucun appel réseau).
 *
 * Réponse : { ok, total, updated, skipped, unmatchedLocalites }
 *   - total : nb de lignes vues (au moins une colonne géo manquante)
 *   - updated : nb de lignes effectivement mises à jour
 *   - skipped : nb de lignes ignorées (pas de match gazetteer)
 *   - unmatchedLocalites : liste des localités non reconnues — sert à
 *     enrichir le gazetteer plus tard
 *
 * Idempotente : peut être rejouée sans effet de bord, ne touche jamais
 * une colonne déjà renseignée.
 */
adminRoutes.post('/backfill-geocoding', async (req, res, next) => {
  try {
    if (!req.user) throw new ForbiddenError();
    const userId = req.user.userId;
    const result = await backfillMissionsGeocoding();
    logger.info(
      { userId, ...result },
      `Backfill geocoding terminé · ${result.updated}/${result.total} missions mises à jour`,
    );
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});
