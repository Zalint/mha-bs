import type { AuthTokens, LoginInput } from '@mha-bs/shared';

import { UnauthorizedError } from '../lib/errors.js';
import { signAccessToken, signRefreshToken } from '../lib/jwt.js';
import { verifyPassword } from '../lib/password.js';
import { findUserByUsername, toPublicUser, touchLastLogin } from '../models/userModel.js';

export async function loginWithCredentials(input: LoginInput): Promise<AuthTokens> {
  const user = await findUserByUsername(input.username);
  if (!user || !user.isActive) {
    throw new UnauthorizedError('Identifiants invalides');
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    throw new UnauthorizedError('Identifiants invalides');
  }

  await touchLastLogin(user.id);

  const payload = { userId: user.id, role: user.role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    user: toPublicUser(user),
  };
}
