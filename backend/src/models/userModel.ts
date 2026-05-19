import { queryAll, queryOne } from '../db/query.js';

import type { UserRole } from '@mha-bs/shared';

export interface UserRow {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    isActive: row.isActive,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  return queryOne<UserRow>(
    `SELECT "id", "username", "email", "passwordHash", "fullName", "role", "isActive",
            "lastLoginAt", "createdAt", "updatedAt"
     FROM "users"
     WHERE "username" = $1
     LIMIT 1`,
    [username],
  );
}

export async function findUserById(id: string): Promise<UserRow | null> {
  return queryOne<UserRow>(
    `SELECT "id", "username", "email", "passwordHash", "fullName", "role", "isActive",
            "lastLoginAt", "createdAt", "updatedAt"
     FROM "users"
     WHERE "id" = $1
     LIMIT 1`,
    [id],
  );
}

export async function listUsers(): Promise<PublicUser[]> {
  const rows = await queryAll<UserRow>(
    `SELECT "id", "username", "email", "passwordHash", "fullName", "role", "isActive",
            "lastLoginAt", "createdAt", "updatedAt"
     FROM "users"
     ORDER BY "createdAt" DESC`,
  );
  return rows.map(toPublicUser);
}

export async function createUser(input: {
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
}): Promise<PublicUser> {
  const row = await queryOne<UserRow>(
    `INSERT INTO "users" ("username", "email", "passwordHash", "fullName", "role")
     VALUES ($1, $2, $3, $4, $5)
     RETURNING "id", "username", "email", "passwordHash", "fullName", "role", "isActive",
               "lastLoginAt", "createdAt", "updatedAt"`,
    [input.username, input.email, input.passwordHash, input.fullName, input.role],
  );
  if (!row) throw new Error('Echec de creation de user');
  return toPublicUser(row);
}

export async function touchLastLogin(id: string): Promise<void> {
  await queryOne(`UPDATE "users" SET "lastLoginAt" = NOW() WHERE "id" = $1 RETURNING "id"`, [id]);
}

export { toPublicUser };
