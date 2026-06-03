import { Router } from 'express';
import { z } from 'zod';

import { NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { authJwt } from '../../middlewares/authJwt.js';
import { validate } from '../../middlewares/validate.js';
import {
  countUnread,
  deleteAlerte,
  generateAlertesForUser,
  listAlertes,
  markAllAsRead,
  markAsRead,
} from '../../models/alerteModel.js';

export const alerteRoutes = Router();

const listQuerySchema = z.object({
  lue: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  categorie: z.enum(['critique', 'warning', 'info']).optional(),
});

/**
 * GET /api/alertes — liste les alertes de l'utilisateur courant
 */
alerteRoutes.get('/', authJwt, validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const filters = req.query as unknown as z.infer<typeof listQuerySchema>;
    const items = await listAlertes(req.user.userId, filters);
    const unread = await countUnread(req.user.userId);
    res.json({ items, unread });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/alertes/count-unread — compteur léger pour la sidebar
 */
alerteRoutes.get('/count-unread', authJwt, async (req, res, next) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const count = await countUnread(req.user.userId);
    res.json({ unread: count });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/alertes/:id/lue — marquer une alerte comme lue
 */
alerteRoutes.patch('/:id/lue', authJwt, async (req, res, next) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const ok = await markAsRead(req.params.id, req.user.userId);
    if (!ok) throw new NotFoundError('Alerte introuvable');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/alertes/tout-lu — marquer toutes les alertes comme lues
 */
alerteRoutes.patch('/tout-lu', authJwt, async (req, res, next) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const updated = await markAllAsRead(req.user.userId);
    res.json({ updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/alertes/:id — supprimer une alerte
 */
alerteRoutes.delete('/:id', authJwt, async (req, res, next) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const ok = await deleteAlerte(req.params.id, req.user.userId);
    if (!ok) throw new NotFoundError('Alerte introuvable');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/alertes/generer — déclenche la génération auto pour l'utilisateur
 * (à appeler manuellement ou via cron). Idempotent.
 */
alerteRoutes.post('/generer', authJwt, async (req, res, next) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const stats = await generateAlertesForUser(req.user.userId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});
