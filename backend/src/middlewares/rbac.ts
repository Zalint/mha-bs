import type { NextFunction, Request, Response } from 'express';

import type { UserRole } from '@mha-bs/shared';

import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

/**
 * Vérifie que le user authentifié possède au moins l'un des rôles requis.
 *
 * Usage : router.post('/x', authJwt, requireRole('bs', 'admin'), handler)
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError());
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Role insuffisant pour cette action'));
    }
    next();
  };
}
