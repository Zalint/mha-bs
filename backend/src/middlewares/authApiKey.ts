import type { NextFunction, Request, Response } from 'express';

import { queryOne } from '../db/query.js';
import { UnauthorizedError } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKey?: { id: string; nomIntegration: string; scopes: string[] };
    }
  }
}

interface ApiKeyRow {
  id: string;
  nomIntegration: string;
  keyHash: string;
  scopes: string[];
  isActive: boolean;
  expiresAt: Date | null;
}

/**
 * Authentification externe via header x-api-key.
 * La clé en clair est comparée au hash bcrypt stocké en base.
 *
 * Optimisation future : préfixe 8 caractères (keyPrefix) pour cibler la lookup,
 * puis bcrypt sur le candidat unique.
 */
export async function authApiKey(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const provided = req.headers['x-api-key'];
    if (typeof provided !== 'string' || provided.length < 16) {
      throw new UnauthorizedError('Header x-api-key manquant ou invalide');
    }

    const prefix = provided.slice(0, 8);
    const candidates = await queryOne<ApiKeyRow>(
      `SELECT "id", "nomIntegration", "keyHash", "scopes", "isActive", "expiresAt"
       FROM "apiKeys"
       WHERE "keyPrefix" = $1 AND "isActive" = TRUE
         AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
       LIMIT 1`,
      [prefix],
    );

    if (!candidates) throw new UnauthorizedError('Cle API inconnue');

    const ok = await verifyPassword(provided, candidates.keyHash);
    if (!ok) throw new UnauthorizedError('Cle API invalide');

    req.apiKey = {
      id: candidates.id,
      nomIntegration: candidates.nomIntegration,
      scopes: candidates.scopes,
    };

    // Best-effort : ne pas attendre
    void queryOne(`UPDATE "apiKeys" SET "lastUsedAt" = NOW() WHERE "id" = $1 RETURNING "id"`, [
      candidates.id,
    ]);

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Helper non lié au middleware : hashe une clé en clair pour stockage.
 */
export async function hashApiKey(plain: string): Promise<string> {
  return hashPassword(plain);
}
