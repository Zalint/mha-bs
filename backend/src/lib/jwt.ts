import jwt, { type SignOptions } from 'jsonwebtoken';

import type { UserRole } from '@mha-bs/shared';

import { appConfig } from '../config/index.js';
import { UnauthorizedError } from './errors.js';

export interface JwtPayload {
  userId: string;
  role: UserRole;
}

export function signAccessToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: appConfig.jwt.accessExpires as SignOptions['expiresIn'] };
  return jwt.sign(payload, appConfig.jwt.accessSecret, options);
}

export function signRefreshToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: appConfig.jwt.refreshExpires as SignOptions['expiresIn'] };
  return jwt.sign(payload, appConfig.jwt.refreshSecret, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, appConfig.jwt.accessSecret) as JwtPayload;
  } catch {
    throw new UnauthorizedError('Token invalide ou expire');
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, appConfig.jwt.refreshSecret) as JwtPayload;
  } catch {
    throw new UnauthorizedError('Refresh token invalide ou expire');
  }
}
