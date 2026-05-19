/**
 * Script de migration : importe les donnees de SUIVIACTION MINISTERIELLE MHA.xlsx
 * vers PostgreSQL. Idempotent : ne reinsere pas les entites deja presentes.
 *
 * Tables peuplees :
 *   - rencontres (deduit a partir des lignes PLAN)
 *   - directives (198 lignes de la feuille PLAN)
 *   - recommandationsMatrice (COPIL, CNGI, Reformes)
 *   - reunionsTechniques (feuille Suivi Rtechnique)
 *
 * Usage : npm run db:migrate-excel -- /chemin/vers/fichier.xlsx
 *         (le chemin par defaut est mockups/../../Downloads/SUIVIACTION MINISTERIELLE MHA.xlsx
 *          ou peut etre fourni par EXCEL_PATH dans .env)
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as XLSX from 'xlsx';

import { closePool, pingDb } from '../db/pool.js';
import { query, queryOne } from '../db/query.js';
import { logger } from '../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type UnknownRow = Record<string, unknown>;

const TYPE_RENCONTRE_MAP: Record<string, string> = {
  'CONSEIL HEBDOMADAIRE DES MINISTRES': 'conseilMinistres',
  'CONSEILS/REUNIONS INTERMINISTERIELS': 'conseilInterMinisteriel',
  'COORDINATION MSGG/SG': 'coordinationSggSg',
};

const ETAT_MAP: Record<string, string> = {
  'Réalisée': 'realisee',
  Realisee: 'realisee',
  'En cours': 'enCours',
  'En attente': 'attente',
  Ineligible: 'ineligible',
  'Inéligible': 'ineligible',
};

function normalizeString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function excelSerialToYmd(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  // Excel : 1 = 1900-01-01 (avec bug du 29 fev 1900 inexistant).
  // 25569 = nombre de jours entre 1900-01-01 et 1970-01-01 (epoch JS).
  const utcMs = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  // Date Excel serialisee : nombre depuis 1900
  if (typeof v === 'number') return excelSerialToYmd(v);
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, '0');
    const d = String(v.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  // DD-MM-YYYY → YYYY-MM-DD
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // Deja au bon format
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function normalizeInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

async function migratePlan(rows: UnknownRow[]): Promise<{ rencontres: number; directives: number }> {
  let rencCount = 0;
  let dirCount = 0;
  const rencCache = new Map<string, string>();

  for (const r of rows) {
    const typeRaw = normalizeString(r['TYPE RENCONTRE']);
    const codeRenc = normalizeString(r['CODE RENCONTRE']);
    const intitule = normalizeString(r['RENCONTRE']);
    const dateRenc = normalizeDate(r['DATE RENCONTRE']);
    const codeDir = normalizeString(r['CODE DIRECTIVE']);
    const texteDir = normalizeString(r['DIRECTIVES']);

    if (!codeRenc || !codeDir || !texteDir || !intitule || !dateRenc) continue;
    const typeRencontre = TYPE_RENCONTRE_MAP[typeRaw ?? ''] ?? null;
    if (!typeRencontre) continue;

    // Upsert rencontre
    let rencontreId = rencCache.get(codeRenc);
    if (!rencontreId) {
      const existing = await queryOne<{ id: string }>(
        `SELECT "id" FROM "rencontres" WHERE "codeRencontre" = $1`,
        [codeRenc],
      );
      if (existing) {
        rencontreId = existing.id;
      } else {
        const annee = normalizeInt(r['ANNEE']) ?? Number(dateRenc.slice(0, 4));
        const created = await queryOne<{ id: string }>(
          `INSERT INTO "rencontres" ("typeRencontre", "codeRencontre", "intitule", "dateRencontre", "annee")
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT ("codeRencontre") DO UPDATE SET "intitule" = EXCLUDED."intitule"
           RETURNING "id"`,
          [typeRencontre, codeRenc, intitule, dateRenc, annee],
        );
        rencontreId = created?.id;
        if (rencontreId) rencCount++;
      }
      if (rencontreId) rencCache.set(codeRenc, rencontreId);
    }
    if (!rencontreId) continue;

    // Insert directive (skip si existe)
    const exists = await queryOne<{ id: string }>(
      `SELECT "id" FROM "directives" WHERE "codeDirective" = $1`,
      [codeDir],
    );
    if (exists) continue;

    const etat = ETAT_MAP[normalizeString(r['ETAT']) ?? ''] ?? 'attente';
    const echeance = normalizeDate(r['ECHEANCE']);
    const debutExecution = normalizeDate(r['DEBUT EXECUTION']);
    const finExecution = normalizeDate(r['FIN EXECUTION']);
    const joursPrevu = normalizeInt(r['NOMBRE JOUR DE TRAITEMENT PREVU']);
    const joursReel = normalizeInt(r['NOMBRE JOUR DE TRAITEMENT REEL']);
    const joursRetardDemarrage = normalizeInt(r['NOMBRE JOUR RETARD DEMARRAGE']);
    const derniereDateTraitement = normalizeDate(r['Dernière date Traitement']);
    const commentaires = normalizeString(r['Commentaires']);
    const typeCause = normalizeString(r['TYPE CAUSE']);
    const ministeresRaw = normalizeString(r['MINISTERES ASSOCIES']) ?? '';
    const ministeres = ministeresRaw
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);

    await query(
      `INSERT INTO "directives" (
         "rencontreId", "codeDirective", "texteDirective", "ministeresAssocies",
         "echeance", "debutExecution", "finExecution", "etat", "typeCause",
         "joursPrevu", "joursReel", "joursRetardDemarrage", "derniereDateTraitement", "commentaires",
         "statutValidation"
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'valide')`,
      [
        rencontreId,
        codeDir,
        texteDir,
        ministeres,
        echeance,
        debutExecution,
        finExecution,
        etat,
        typeCause,
        joursPrevu,
        joursReel,
        joursRetardDemarrage,
        derniereDateTraitement,
        commentaires,
      ],
    );
    dirCount++;
  }

  return { rencontres: rencCount, directives: dirCount };
}

async function migrateCopil(workbook: XLSX.WorkBook): Promise<number> {
  const sheet = workbook.Sheets['Suivi Recom Copil'];
  if (!sheet) {
    logger.warn('Feuille "Suivi Recom Copil" absente, skip');
    return 0;
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  const copilMap: Record<string, string> = {
    'PROGEP II': 'copilProgepIi',
    PISEA: 'copilPisea',
    'PASEA-RD': 'copilPaseaRd',
    PDBH: 'copilPdbh',
    PROMOREN: 'copilPromoren',
  };

  let currentType: string | null = null;
  let inserted = 0;

  for (const row of rows) {
    const col1 = normalizeString(row[0]);
    const col2 = normalizeString(row[1]);
    if (!col2 && !col1) continue;

    // En-tête de section : col2 contient un nom de COPIL
    if (col2 && !col1 && copilMap[col2.toUpperCase()]) {
      currentType = copilMap[col2.toUpperCase()] ?? null;
      continue;
    }

    // Ligne de recommandation : col1 = numéro, col2 = texte
    if (currentType && col1 && col2) {
      const num = Number(col1);
      if (!Number.isFinite(num)) continue;
      const exists = await queryOne<{ id: string }>(
        `SELECT "id" FROM "recommandationsMatrice" WHERE "typeMatrice" = $1 AND "numOrdre" = $2`,
        [currentType, num],
      );
      if (exists) continue;
      await query(
        `INSERT INTO "recommandationsMatrice" ("typeMatrice", "numOrdre", "texteRecommandation", "etat")
         VALUES ($1, $2, $3, 'attente')`,
        [currentType, num, col2],
      );
      inserted++;
    }
  }
  return inserted;
}

async function migrateCngi(workbook: XLSX.WorkBook): Promise<number> {
  const sheet = workbook.Sheets['Suivi Recom CNGI'];
  if (!sheet) {
    logger.warn('Feuille "Suivi Recom CNGI" absente, skip');
    return 0;
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  let inserted = 0;
  let numOrdre = 0;
  for (const row of rows) {
    // Le texte CNGI se trouve dans la colonne 0 (premier element)
    const texte = normalizeString(row[0]) ?? normalizeString(row[1]);
    if (!texte) continue;
    if (
      texte.startsWith('Suivi Recommandations') ||
      texte.startsWith("Etat d'") ||
      texte === 'Les Recommandations' ||
      texte === 'Observations'
    ) {
      continue;
    }
    numOrdre++;
    const exists = await queryOne<{ id: string }>(
      `SELECT "id" FROM "recommandationsMatrice" WHERE "typeMatrice" = 'cngi' AND "numOrdre" = $1`,
      [numOrdre],
    );
    if (exists) continue;
    await query(
      `INSERT INTO "recommandationsMatrice" ("typeMatrice", "numOrdre", "texteRecommandation", "etat")
       VALUES ('cngi', $1, $2, 'attente')`,
      [numOrdre, texte],
    );
    inserted++;
  }
  return inserted;
}

async function migrateReformeAssainissement(workbook: XLSX.WorkBook): Promise<number> {
  const sheet = workbook.Sheets["Réf sur l'ASS"];
  if (!sheet) {
    logger.warn('Feuille "Réf sur l\'ASS" absente, skip');
    return 0;
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  let inserted = 0;
  let numOrdre = 0;
  for (const row of rows) {
    const texte = normalizeString(row[1]);
    if (!texte) continue;
    if (
      texte.startsWith('Matrice') ||
      texte.startsWith('Réformes') ||
      texte === 'Recommandations'
    ) {
      continue;
    }
    numOrdre++;
    const exists = await queryOne<{ id: string }>(
      `SELECT "id" FROM "recommandationsMatrice" WHERE "typeMatrice" = 'reformeAssainissement' AND "numOrdre" = $1`,
      [numOrdre],
    );
    if (exists) continue;
    await query(
      `INSERT INTO "recommandationsMatrice" ("typeMatrice", "numOrdre", "texteRecommandation", "etat")
       VALUES ('reformeAssainissement', $1, $2, 'attente')`,
      [numOrdre, texte],
    );
    inserted++;
  }
  return inserted;
}

async function migrateReformeInstitutionnelle(workbook: XLSX.WorkBook): Promise<number> {
  const sheet = workbook.Sheets['Sui FeuilleR Ref Inst'];
  if (!sheet) {
    logger.warn('Feuille "Sui FeuilleR Ref Inst" absente, skip');
    return 0;
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  let inserted = 0;
  let numOrdre = 0;
  for (const row of rows) {
    const activite = normalizeString(row[0]);
    const echeance = normalizeString(row[1]);
    const priorite = normalizeString(row[2]);
    if (!activite) continue;
    if (
      activite.startsWith('Feuille de Route') ||
      activite === 'Planification des Activités' ||
      activite.includes('Activités')
    ) {
      continue;
    }
    numOrdre++;
    const trimestre = echeance && /^T[1-4]$/.test(echeance) ? echeance : null;
    const priority = priorite?.toLowerCase().match(/^(urgent|prioritaire|obligatoire)$/) ? priorite.toLowerCase() : 'standard';
    const exists = await queryOne<{ id: string }>(
      `SELECT "id" FROM "recommandationsMatrice" WHERE "typeMatrice" = 'reformeInstitutionnelle' AND "numOrdre" = $1`,
      [numOrdre],
    );
    if (exists) continue;
    await query(
      `INSERT INTO "recommandationsMatrice" ("typeMatrice", "numOrdre", "texteRecommandation", "etat", "echeanceTrimestre", "priorite")
       VALUES ('reformeInstitutionnelle', $1, $2, 'attente', $3, $4)`,
      [numOrdre, activite, trimestre, priority],
    );
    inserted++;
  }
  return inserted;
}

async function migrateReunions(workbook: XLSX.WorkBook): Promise<number> {
  const sheet = workbook.Sheets['Suivi Rtechnique'];
  if (!sheet) {
    logger.warn('Feuille "Suivi Rtechnique" absente, skip');
    return 0;
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  let inserted = 0;
  for (const row of rows) {
    // Date en colonne 0 (souvent un numero serie Excel), theme en colonne 1
    const date = normalizeDate(row[0]);
    const theme = normalizeString(row[1]);
    if (!date || !theme) continue;
    if (theme === 'Théme' || theme === 'Date' || theme === 'Theme') continue;

    const exists = await queryOne<{ id: string }>(
      `SELECT "id" FROM "reunionsTechniques" WHERE "dateReunion" = $1 AND "theme" = $2 LIMIT 1`,
      [date, theme],
    );
    if (exists) continue;

    await query(
      `INSERT INTO "reunionsTechniques" ("dateReunion", "theme", "participants")
       VALUES ($1, $2, '[]'::jsonb)`,
      [date, theme],
    );
    inserted++;
  }
  return inserted;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const arg = process.argv[2];
  const candidates = [
    arg,
    process.env.EXCEL_PATH,
    path.resolve(__dirname, '../../../../Downloads/SUIVIACTION MINISTERIELLE MHA.xlsx'),
    path.resolve(process.env.USERPROFILE ?? process.env.HOME ?? '', 'Downloads/SUIVIACTION MINISTERIELLE MHA.xlsx'),
  ].filter((p): p is string => typeof p === 'string' && p.length > 0);

  const excelPath = candidates.find((p) => existsSync(p));
  if (!excelPath) {
    logger.fatal({ candidates }, "Fichier Excel introuvable. Passez le chemin en argument ou via EXCEL_PATH.");
    process.exit(1);
  }
  logger.info({ excelPath }, 'Chargement du fichier Excel');

  const buffer = readFileSync(excelPath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  await pingDb();

  const planSheet = workbook.Sheets['PLAN'];
  if (!planSheet) {
    logger.fatal('Feuille "PLAN" absente du fichier Excel');
    process.exit(1);
  }
  const planRows = XLSX.utils.sheet_to_json<UnknownRow>(planSheet, { range: 4 }); // entête ligne 5
  logger.info({ count: planRows.length }, 'Lignes PLAN trouvées');

  const planResult = await migratePlan(planRows);
  const copilCount = await migrateCopil(workbook);
  const cngiCount = await migrateCngi(workbook);
  const refAssCount = await migrateReformeAssainissement(workbook);
  const refInstCount = await migrateReformeInstitutionnelle(workbook);
  const reunionsCount = await migrateReunions(workbook);

  logger.info(
    {
      rencontresInserees: planResult.rencontres,
      directivesInserees: planResult.directives,
      copilInserees: copilCount,
      cngiInserees: cngiCount,
      reformeAssainissementInserees: refAssCount,
      reformeInstitutionnelleInserees: refInstCount,
      reunionsInserees: reunionsCount,
    },
    'Migration terminée',
  );
}

main()
  .catch((err) => {
    logger.fatal({ err }, 'Echec migration Excel');
    process.exit(1);
  })
  .finally(() => {
    void closePool();
  });
