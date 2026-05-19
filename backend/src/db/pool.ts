import pg from 'pg';

import { appConfig } from '../config/index.js';
import { logger } from '../lib/logger.js';

const { Pool } = pg;

/**
 * Pool PostgreSQL partagé pour toute l'app.
 * SSL activé automatiquement sur Render (DATABASE_URL avec sslmode).
 */
export const pool = new Pool({
  connectionString: appConfig.database.url,
  ssl: appConfig.isProd ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Pool PostgreSQL erreur inattendue');
});

export async function pingDb(): Promise<void> {
  const result = await pool.query<{ ok: number }>('SELECT 1 AS ok');
  if (result.rows[0]?.ok !== 1) {
    throw new Error('Ping DB invalide');
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
