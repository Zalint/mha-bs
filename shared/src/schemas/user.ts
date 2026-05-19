import { z } from 'zod';

import { USER_ROLES } from '../constants.js';

export const userSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3).max(50),
  email: z.string().email().max(255),
  fullName: z.string().min(2).max(150),
  role: z.enum(USER_ROLES),
  isActive: z.boolean(),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof userSchema>;

export const createUserSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-z0-9._-]+$/i, 'username doit etre alphanumerique'),
  email: z.string().email().max(255),
  fullName: z.string().min(2).max(150),
  role: z.enum(USER_ROLES),
  password: z.string().min(8).max(128),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = createUserSchema.partial().omit({ password: true, username: true }).extend({
  isActive: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(128),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: userSchema,
});
export type AuthTokens = z.infer<typeof authTokensSchema>;
