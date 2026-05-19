/**
 * Script idempotent : cree le user admin initial s'il n'existe pas deja.
 *
 * Variables utilisees :
 *   - BOOTSTRAP_ADMIN_USERNAME
 *   - BOOTSTRAP_ADMIN_EMAIL
 *   - BOOTSTRAP_ADMIN_PASSWORD  (en clair, jamais commit)
 *   - BOOTSTRAP_ADMIN_FULLNAME
 *
 * Usage : npm run db:bootstrap-admin
 */
import { appConfig } from '../config/index.js';
import { queryOne } from '../db/query.js';
import { closePool, pingDb } from '../db/pool.js';
import { logger } from '../lib/logger.js';
import { hashPassword } from '../lib/password.js';

async function main(): Promise<void> {
  await pingDb();

  const { username, email, password, fullName } = appConfig.bootstrap;

  if (password === 'changeMeOnFirstLogin') {
    logger.warn('BOOTSTRAP_ADMIN_PASSWORD est la valeur par defaut. Definissez une vraie valeur en production.');
  }

  const existing = await queryOne<{ id: string }>(
    `SELECT "id" FROM "users" WHERE "username" = $1 OR "email" = $2 LIMIT 1`,
    [username, email],
  );

  if (existing) {
    logger.info({ userId: existing.id }, 'Admin deja existant, skip');
    return;
  }

  const passwordHash = await hashPassword(password);
  const created = await queryOne<{ id: string }>(
    `INSERT INTO "users" ("username", "email", "passwordHash", "fullName", "role", "isActive")
     VALUES ($1, $2, $3, $4, 'admin', TRUE)
     RETURNING "id"`,
    [username, email, passwordHash, fullName],
  );

  logger.info({ userId: created?.id, username, email }, 'Admin cree avec succes');
}

main()
  .catch((err) => {
    logger.fatal({ err }, 'Echec bootstrapAdmin');
    process.exit(1);
  })
  .finally(() => {
    void closePool();
  });
