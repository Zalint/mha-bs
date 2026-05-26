/**
 * Script CLI : importe les données depuis un fichier Excel local.
 *
 * Toute la logique de parsing vit dans `excelImportService.ts`. Ce script est
 * un wrapper qui lit un fichier sur disque et appelle le service. La même
 * logique est exposée via la route HTTP `POST /api/import`.
 *
 * Usage : npm run db:migrate-excel -- /chemin/vers/fichier.xlsx
 *         (chemin par défaut : backend/data/seed.xlsx, ou EXCEL_PATH)
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { closePool, pingDb } from '../db/pool.js';
import { logger } from '../lib/logger.js';
import { importWorkbook } from '../services/excelImportService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  const arg = process.argv[2];
  const candidates = [
    arg,
    process.env.EXCEL_PATH,
    path.resolve(process.cwd(), 'backend/data/seed.xlsx'),
    path.resolve(__dirname, '../../../data/seed.xlsx'),
    path.resolve(__dirname, '../../../../Downloads/SUIVIACTION MINISTERIELLE MHA.xlsx'),
    path.resolve(process.env.USERPROFILE ?? process.env.HOME ?? '', 'Downloads/SUIVIACTION MINISTERIELLE MHA.xlsx'),
  ].filter((p): p is string => typeof p === 'string' && p.length > 0);

  const excelPath = candidates.find((p) => existsSync(p));
  if (!excelPath) {
    logger.warn({ candidates }, "Fichier Excel introuvable, skip migration");
    return;
  }
  logger.info({ excelPath }, 'Chargement du fichier Excel');

  const buffer = readFileSync(excelPath);
  await pingDb();
  const summary = await importWorkbook(buffer);
  logger.info(summary, 'Migration terminée');
}

main()
  .catch((err) => {
    logger.fatal({ err }, 'Échec migration Excel');
    process.exit(1);
  })
  .finally(() => {
    void closePool();
  });
