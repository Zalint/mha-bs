/**
 * Script idempotent : déduit "sousSecteur" et "copilLie" pour les réunions techniques
 * existantes, à partir du champ "theme" (et "lieu" en fallback).
 *
 * Re-runnable : ne touche que les colonnes encore NULL ou vides.
 *
 * Usage : npm run backfill:reunions
 */
import { closePool, pingDb } from '../db/pool.js';
import { query, queryAll } from '../db/query.js';
import { logger } from '../lib/logger.js';

interface ReunionRow {
  id: string;
  theme: string;
  lieu: string | null;
  sousSecteur: string | null;
  copilLie: string | null;
}

const SOUS_SECTEUR_PATTERNS: { regex: RegExp; key: string }[] = [
  { regex: /\b(eau potable|hydraulique villageoise|adduction|forage|aep|access? \w* eau)\b/i, key: 'eau' },
  { regex: /\b(gire|ressources? en eau|gestion intégrée|bassin\s*versant|aquifere)\b/i, key: 'gire' },
  { regex: /\b(assainissement|eaux usées|station d['’]épuration|onas|latrine|step)\b/i, key: 'assainissement' },
  { regex: /\b(inondation|pluvial|drainage|crue|hivernage|bassin de rétention)\b/i, key: 'inondations' },
  { regex: /\b(réforme|institutionnel|gouvernance|cadre juridique|loi)\b/i, key: 'reformeInstitutionnelle' },
];

const COPIL_PATTERNS: { regex: RegExp; copil: string }[] = [
  { regex: /\bprogep\b/i, copil: 'PROGEP II' },
  { regex: /\bpisea\b/i, copil: 'PISEA' },
  { regex: /\bpasea/i, copil: 'PASEA-RD' },
  { regex: /\bpdbh\b/i, copil: 'PDBH' },
  { regex: /\bpromoren\b/i, copil: 'PROMOREN' },
];

function inferSousSecteur(text: string): string {
  for (const { regex, key } of SOUS_SECTEUR_PATTERNS) {
    if (regex.test(text)) return key;
  }
  return 'transversal';
}

function inferCopil(text: string): string | null {
  for (const { regex, copil } of COPIL_PATTERNS) {
    if (regex.test(text)) return copil;
  }
  return null;
}

async function main(): Promise<void> {
  await pingDb();

  const rows = await queryAll<ReunionRow>(
    `SELECT "id", "theme", "lieu", "sousSecteur", "copilLie"
     FROM "reunionsTechniques"`,
  );

  let updated = 0;
  let alreadyCategorized = 0;
  let noCopilDetected = 0;

  for (const row of rows) {
    const haystack = `${row.theme ?? ''} ${row.lieu ?? ''}`;
    const needSousSecteur = !row.sousSecteur;
    const needCopil = !row.copilLie;

    if (!needSousSecteur && !needCopil) {
      alreadyCategorized++;
      continue;
    }

    const nextSousSecteur = needSousSecteur ? inferSousSecteur(haystack) : row.sousSecteur;
    const nextCopil = needCopil ? inferCopil(haystack) : row.copilLie;

    if (needCopil && nextCopil === null) noCopilDetected++;

    await query(
      `UPDATE "reunionsTechniques"
       SET "sousSecteur" = $2, "copilLie" = $3
       WHERE "id" = $1`,
      [row.id, nextSousSecteur, nextCopil],
    );
    updated++;
  }

  logger.info(
    { total: rows.length, updated, alreadyCategorized, noCopilDetected },
    'Backfill réunions terminé',
  );
}

main()
  .catch((err) => {
    logger.fatal({ err }, 'Échec backfill réunions');
    process.exit(1);
  })
  .finally(() => {
    void closePool();
  });
