/**
 * Cree la base de donnees cible si elle n'existe pas.
 * Se connecte a la base "postgres" (defaut) avec les memes credentials et execute CREATE DATABASE.
 * Idempotent.
 *
 * Usage : npm run db:create
 */
import pg from 'pg';

import { appConfig } from '../config/index.js';
import { logger } from '../lib/logger.js';

async function main(): Promise<void> {
  const url = new URL(appConfig.database.url);
  const targetDbName = decodeURIComponent(url.pathname.slice(1));
  if (!targetDbName) {
    throw new Error('DATABASE_URL ne contient pas de nom de base apres /');
  }

  // Connexion a la base systeme "postgres"
  url.pathname = '/postgres';
  const adminUrl = url.toString();

  const masked = adminUrl.replace(/:[^@/]+@/, ':****@');
  logger.info({ admin: masked, target: targetDbName }, 'Verification de la base cible');

  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();

  try {
    const res = await client.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS "exists"`,
      [targetDbName],
    );

    if (res.rows[0]?.exists) {
      logger.info(`Base "${targetDbName}" deja existante`);
      return;
    }

    // CREATE DATABASE n'accepte pas les parametres : on echappe les guillemets
    const safeName = targetDbName.replace(/"/g, '""');
    await client.query(`CREATE DATABASE "${safeName}"`);
    logger.info(`Base "${targetDbName}" creee`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  logger.fatal({ err }, 'Echec creation de la base');
  process.exit(1);
});
