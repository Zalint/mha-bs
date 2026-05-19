import type { NextFunction, Request, Response } from 'express';

import { UnauthorizedError } from '../lib/errors.js';
import { verifyAccessToken, type JwtPayload } from '../lib/jwt.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Vérifie le header Authorization: Bearer <token> et hydrate req.user.
 */
export function authJwt(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Authorization header manquant'));
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
}
