import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { changePasswordSchema, loginSchema } from '@mha-bs/shared';

import { appConfig } from '../../config/index.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { authJwt } from '../../middlewares/authJwt.js';
import { validate } from '../../middlewares/validate.js';
import { findUserById, toPublicUser, updateUserPassword } from '../../models/userModel.js';
import { loginWithCredentials } from '../../services/authService.js';

export const authRoutes = Router();

const loginLimiter = rateLimit({
  windowMs: appConfig.rateLimit.windowMs,
  max: appConfig.rateLimit.loginMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Trop de tentatives, reessayez plus tard' } },
});

authRoutes.post('/login', loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const tokens = await loginWithCredentials(req.body);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

authRoutes.post('/refresh', async (req, res, next) => {
  try {
    const provided = req.body?.refreshToken;
    if (typeof provided !== 'string' || provided.length < 10) {
      throw new UnauthorizedError('refreshToken manquant');
    }
    const payload = verifyRefreshToken(provided);
    const accessToken = signAccessToken({ userId: payload.userId, role: payload.role });
    const refreshToken = signRefreshToken({ userId: payload.userId, role: payload.role });
    res.json({ accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

authRoutes.post('/logout', (_req, res) => {
  // JWT stateless : côté serveur on ne fait rien (à terme, blacklist refresh token).
  res.status(204).end();
});

authRoutes.get('/me', authJwt, async (req, res, next) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const user = await findUserById(req.user.userId);
    if (!user) throw new UnauthorizedError('Utilisateur introuvable');
    res.json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
});

authRoutes.post('/change-password', authJwt, validate(changePasswordSchema), async (req, res, next) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    const user = await findUserById(req.user.userId);
    if (!user) throw new UnauthorizedError('Utilisateur introuvable');

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedError('Mot de passe actuel incorrect');

    const hash = await hashPassword(newPassword);
    await updateUserPassword(user.id, hash);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
