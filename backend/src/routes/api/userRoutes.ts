import { Router } from 'express';
import { z } from 'zod';

import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
} from '@mha-bs/shared';

import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { hashPassword } from '../../lib/password.js';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import {
  createUser,
  findUserById,
  findUserByUsername,
  listUsers,
  toPublicUser,
  updateUserBasics,
  updateUserPassword,
} from '../../models/userModel.js';

export const userRoutes = Router();

userRoutes.use(authJwt, requireRole('admin'));

userRoutes.get('/', async (_req, res, next) => {
  try {
    const items = await listUsers();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

userRoutes.post('/', validate(createUserSchema), async (req, res, next) => {
  try {
    const input = req.body as z.infer<typeof createUserSchema>;
    const existing = await findUserByUsername(input.username);
    if (existing) throw new ConflictError('Username deja utilise');

    const passwordHash = await hashPassword(input.password);
    const created = await createUser({
      username: input.username,
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: input.role,
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

const idParam = z.object({ id: z.string().uuid() });

userRoutes.put('/:id', validate(idParam, 'params'), validate(updateUserSchema), async (req, res, next) => {
  try {
    const { id } = req.params as z.infer<typeof idParam>;
    const patch = req.body as z.infer<typeof updateUserSchema>;
    const updated = await updateUserBasics(id, patch);
    if (!updated) throw new NotFoundError('Utilisateur introuvable');
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

userRoutes.post(
  '/:id/reset-password',
  validate(idParam, 'params'),
  validate(resetPasswordSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params as z.infer<typeof idParam>;
      const { password } = req.body as z.infer<typeof resetPasswordSchema>;
      const hash = await hashPassword(password);
      const ok = await updateUserPassword(id, hash);
      if (!ok) throw new NotFoundError('Utilisateur introuvable');
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

userRoutes.post('/:id/deactivate', validate(idParam, 'params'), async (req, res, next) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { id } = req.params as z.infer<typeof idParam>;
    if (id === req.user.userId) throw new ForbiddenError('Impossible de desactiver son propre compte');
    const target = await findUserById(id);
    if (!target) throw new NotFoundError('Utilisateur introuvable');
    const updated = await updateUserBasics(id, { isActive: false });
    res.json(updated ?? toPublicUser(target));
  } catch (err) {
    next(err);
  }
});

userRoutes.post('/:id/activate', validate(idParam, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params as z.infer<typeof idParam>;
    const updated = await updateUserBasics(id, { isActive: true });
    if (!updated) throw new NotFoundError('Utilisateur introuvable');
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
