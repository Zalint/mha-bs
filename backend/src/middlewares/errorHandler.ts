import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req: Request, res: Response, _next: NextFunction) => {
  // Erreurs Zod : 422 avec détails de validation
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Donnees invalides',
        details: err.flatten(),
      },
    });
  }

  // Erreurs métier connues
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err }, 'Erreur applicative serveur');
    } else {
      logger.warn({ err: { code: err.code, message: err.message } }, 'Erreur applicative cliente');
    }
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Erreurs PostgreSQL — codes courants
  type PgError = { code?: string; detail?: string; constraint?: string };
  const pgErr = err as PgError;
  if (pgErr?.code === '23505') {
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'Donnee deja existante', details: pgErr.detail },
    });
  }

  // Fallback : 500 sans fuite d'information
  logger.error({ err }, 'Erreur non gérée');
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur' },
  });
};
