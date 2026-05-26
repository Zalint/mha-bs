import { Router } from 'express';

import {
  createDirectiveSchema,
  directiveFiltersSchema,
  updateDirectiveSchema,
} from '@mha-bs/shared';

import { z } from 'zod';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../lib/errors.js';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import {
  createCommentaire,
  listCommentaires,
} from '../../models/commentaireModel.js';
import {
  createDirective,
  deleteDirective,
  deleteDirectivesBulk,
  findDirectiveById,
  listDirectives,
  submitDirective,
  updateDirective,
  validateDirective,
} from '../../models/directiveModel.js';

export const directiveRoutes = Router();

directiveRoutes.get('/', authJwt, validate(directiveFiltersSchema, 'query'), async (req, res, next) => {
  try {
    const result = await listDirectives(req.query as never);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

directiveRoutes.get('/:id', authJwt, async (req, res, next) => {
  try {
    const item = await findDirectiveById(req.params.id);
    if (!item) throw new NotFoundError('Directive introuvable');
    res.json(item);
  } catch (err) {
    next(err);
  }
});

directiveRoutes.post(
  '/',
  authJwt,
  requireRole('bs', 'admin'),
  validate(createDirectiveSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const created = await createDirective(req.body, req.user.userId);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

directiveRoutes.put(
  '/:id',
  authJwt,
  requireRole('bs', 'admin'),
  validate(updateDirectiveSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const updated = await updateDirective(req.params.id, req.body, req.user.userId);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

directiveRoutes.delete('/:id', authJwt, requireRole('admin'), async (req, res, next) => {
  try {
    await deleteDirective(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

directiveRoutes.post(
  '/bulk-delete',
  authJwt,
  requireRole('admin'),
  validate(bulkDeleteSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof bulkDeleteSchema>;
      const deleted = await deleteDirectivesBulk(body.ids);
      res.json({ deleted });
    } catch (err) {
      next(err);
    }
  },
);

directiveRoutes.post('/:id/soumettre', authJwt, requireRole('bs', 'admin'), async (req, res, next) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const updated = await submitDirective(req.params.id, req.user.userId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

directiveRoutes.post('/:id/valider', authJwt, requireRole('sg', 'admin'), async (req, res, next) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const updated = await validateDirective(req.params.id, req.user.userId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// --- Commentaires ---

directiveRoutes.get('/:id/commentaires', authJwt, async (req, res, next) => {
  try {
    const directive = await findDirectiveById(req.params.id);
    if (!directive) throw new NotFoundError('Directive introuvable');
    const items = await listCommentaires('directive', req.params.id);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

const createCommentaireSchema = z.object({
  texte: z.string().min(1, 'Texte requis').max(5000),
});

directiveRoutes.post(
  '/:id/commentaires',
  authJwt,
  requireRole('bs', 'admin'),
  validate(createCommentaireSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const directive = await findDirectiveById(req.params.id);
      if (!directive) throw new NotFoundError('Directive introuvable');
      const body = req.body as z.infer<typeof createCommentaireSchema>;
      if (!body.texte.trim()) throw new ValidationError('Texte vide');
      const created = await createCommentaire('directive', req.params.id, body.texte, req.user.userId);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);
