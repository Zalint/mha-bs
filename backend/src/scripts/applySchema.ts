/**
 * Applique database/schema.sql sur la base configuree (DATABASE_URL).
 * Alternative portable a `psql -f schema.sql` (utile sous Windows sans psql).
 *
 * Usage : npm run db:schema
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { appConfig } from '../config/index.js';
import { logger } from '../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
  const sql = readFileSync(schemaPath, 'utf-8');

  const masked = appConfig.database.url.replace(/:[^@/]+@/, ':****@');
  logger.info({ schemaPath, target: masked }, 'Application du schema PostgreSQL');

  const client = new pg.Client({
    connectionString: appConfig.database.url,
    ssl: appConfig.isProd ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  try {
    await client.query(sql);
    logger.info('Schema applique avec succes');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  logger.fatal({ err }, 'Echec application du schema');
  process.exit(1);
});
