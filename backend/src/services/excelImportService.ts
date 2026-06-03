/**
 * Service partagé pour l'import Excel.
 *
 * Utilisé par :
 *   - le script CLI `migrateExcelToDb.ts` (re-seed depuis un fichier local)
 *   - la route HTTP `POST /api/import` (upload depuis l'UI BS)
 *
 * Feuilles traitées (toutes optionnelles — chaque migrate* skip silencieusement
 * si sa feuille n'existe pas) :
 *
 *   Format historique (workbooks d'origine) :
 *   - PLAN                    → rencontres + directives
 *   - Suivi Recom Copil       → recommandationsMatrice (COPIL)
 *   - Suivi Recom CNGI        → recommandationsMatrice (CNGI)
 *   - Réf sur l'ASS           → recommandationsMatrice (reformeAssainissement)
 *   - Sui FeuilleR Ref Inst   → recommandationsMatrice (reformeInstitutionnelle)
 *   - Suivi Rtechnique        → reunionsTechniques
 *
 *   Format export (roundtrip) :
 *   - PLAN                    → rencontres + directives (en-têtes en ligne 1)
 *   - Recommandations         → recommandationsMatrice (flat, colonne Matrice)
 *   - Réunions techniques     → reunionsTechniques (alias de Suivi Rtechnique)
 *   - Missions terrain        → missionsTerrain
 *   - Feuilles "<projet>"     → recommandationsMatrice (une feuille par projet COPIL)
 *
 * Idempotent : ne réinsère pas une entité déjà présente (clé naturelle :
 * codeRencontre, codeDirective, (typeMatrice, numOrdre), (dateReunion, theme),
 * (dateMission, localite)).
 */
import * as crypto from 'node:crypto';

import * as XLSX from 'xlsx';

import { query, queryAll, queryOne } from '../db/query.js';
import { logger } from '../lib/logger.js';

type UnknownRow = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const TYPE_RENCONTRE_MAP: Record<string, string> = {
  'CONSEIL HEBDOMADAIRE DES MINISTRES': 'conseilMinistres',
  'CONSEILS/REUNIONS INTERMINISTERIELS': 'conseilInterMinisteriel',
  'COORDINATION MSGG/SG': 'coordinationSggSg',
};

const ETAT_MAP: Record<string, string> = {
  Réalisée: 'realisee',
  Realisee: 'realisee',
  'En cours': 'enCours',
  'En attente': 'attente',
  Ineligible: 'ineligible',
  Inéligible: 'ineligible',
};

const COPIL_NAME_MAP: Record<string, string> = {
  'PROGEP II': 'copilProgepIi',
  PISEA: 'copilPisea',
  'PASEA-RD': 'copilPaseaRd',
  PDBH: 'copilPdbh',
  PROMOREN: 'copilPromoren',
};

const SOUS_SECTEUR_PATTERNS: { regex: RegExp; key: string }[] = [
  { regex: /\b(eau potable|hydraulique villageoise|adduction|forage|aep|access? \w* eau)\b/i, key: 'eau' },
  { regex: /\b(gire|ressources? en eau|gestion intégrée|bassin\s*versant|aquifere)\b/i, key: 'gire' },
  { regex: /\b(assainissement|eaux usées|station d['’]épuration|onas|latrine|step)\b/i, key: 'assainissement' },
  { regex: /\b(inondation|pluvial|drainage|crue|hivernage|bassin de rétention)\b/i, key: 'inondations' },
  { regex: /\b(réforme|institutionnel|gouvernance|cadre juridique|loi)\b/i, key: 'reformeInstitutionnelle' },
];

const REUNION_COPIL_PATTERNS: { regex: RegExp; copil: string }[] = [
  { regex: /\bprogep\b/i, copil: 'PROGEP II' },
  { regex: /\bpisea\b/i, copil: 'PISEA' },
  { regex: /\bpasea/i, copil: 'PASEA-RD' },
  { regex: /\bpdbh\b/i, copil: 'PDBH' },
  { regex: /\bpromoren\b/i, copil: 'PROMOREN' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function excelSerialToYmd(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
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
  if (typeof v === 'number') return excelSerialToYmd(v);
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, '0');
    const d = String(v.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function normalizeInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function inferSousSecteur(text: string): string {
  for (const { regex, key } of SOUS_SECTEUR_PATTERNS) {
    if (regex.test(text)) return key;
  }
  return 'transversal';
}

function inferCopil(text: string): string | null {
  for (const { regex, copil } of REUNION_COPIL_PATTERNS) {
    if (regex.test(text)) return copil;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

/**
 * Cherche la feuille PLAN dans le classeur. Stratégie :
 *   1. Feuille nommée 'PLAN' (format historique)
 *   2. Sinon la 1ère feuille du classeur (format simplifié, "lire le 1er onglet")
 */
function findPlanSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet | null {
  if (workbook.Sheets['PLAN']) return workbook.Sheets['PLAN'];
  const firstName = workbook.SheetNames[0];
  if (firstName && workbook.Sheets[firstName]) {
    logger.info({ sheetName: firstName }, 'Feuille "PLAN" absente — fallback sur la 1ère feuille');
    return workbook.Sheets[firstName];
  }
  return null;
}

/**
 * Auto-détecte la ligne d'en-tête en cherchant la 1ère ligne qui contient
 * une cellule "DIRECTIVES" ou "DIRECTIVE". Retourne le `range` à utiliser
 * (équivalent au nombre de lignes à skipper avant l'en-tête).
 */
function detectHeaderRow(sheet: XLSX.WorkSheet): number {
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  for (let i = 0; i < Math.min(allRows.length, 15); i++) {
    const row = allRows[i];
    if (!Array.isArray(row)) continue;
    const cells = row.map((c) => String(c ?? '').toUpperCase().trim());
    if (cells.some((c) => c === 'DIRECTIVES' || c === 'DIRECTIVE')) {
      return i;
    }
  }
  return 4; // fallback : format historique = header en L5 (range 4)
}

/**
 * Détecte génériquement la ligne d'en-tête : la 1ère ligne qui contient
 * au moins 2 cellules non vides ressemblant à des libellés (chaînes courtes,
 * pas que des nombres). Utilisé pour les imports dédiés (interpellations,
 * missions) où le format de fichier varie.
 */
function detectGenericHeaderRow(sheet: XLSX.WorkSheet): number {
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  for (let i = 0; i < Math.min(allRows.length, 10); i++) {
    const row = allRows[i];
    if (!Array.isArray(row)) continue;
    const nonEmpty = row.filter((c) => c !== null && String(c).trim() !== '');
    // Au moins 2 cellules non vides, et au moins une chaîne (pas que des numéros)
    if (
      nonEmpty.length >= 2 &&
      nonEmpty.some((c) => typeof c === 'string' && c.length > 0 && c.length < 100)
    ) {
      return i;
    }
  }
  return 0;
}

/**
 * Récupère une valeur dans la ligne en testant plusieurs noms de colonnes
 * possibles (synonymes / variantes de casse / typos courantes).
 */
function pickColumn(row: UnknownRow, ...candidates: string[]): unknown {
  for (const key of candidates) {
    if (key in row) return row[key];
    // Cherche aussi en case-insensitive
    const matchKey = Object.keys(row).find((k) => k.toUpperCase() === key.toUpperCase());
    if (matchKey) return row[matchKey];
  }
  return undefined;
}

async function migratePlan(
  workbook: XLSX.WorkBook,
  opts: { dryRun?: boolean } = {},
): Promise<{ rencontres: number; directives: number }> {
  const planSheet = findPlanSheet(workbook);
  if (!planSheet) {
    logger.warn('Aucune feuille trouvée dans le classeur, skip');
    return { rencontres: 0, directives: 0 };
  }
  const headerRange = detectHeaderRow(planSheet);
  const rows = XLSX.utils.sheet_to_json<UnknownRow>(planSheet, { range: headerRange });

  let rencCount = 0;
  let dirCount = 0;
  const rencCache = new Map<string, string>();

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    if (!r) continue;

    const texteDir = normalizeString(pickColumn(r, 'DIRECTIVES', 'DIRECTIVE', 'Directive'));
    if (!texteDir) continue;

    // Date : essaie DATE RENCONTRE puis DATE RECONTRE (typo courante)
    // puis ECHEANCE en dernier recours
    const dateRenc =
      normalizeDate(pickColumn(r, 'DATE RENCONTRE', 'DATE RECONTRE', 'DATE')) ??
      normalizeDate(pickColumn(r, 'ECHEANCE')) ??
      new Date().toISOString().slice(0, 10);

    // Type de rencontre — défaut conseilMinistres si absent
    const typeRaw = normalizeString(pickColumn(r, 'TYPE RENCONTRE', 'TYPE'));
    const typeRencontre = TYPE_RENCONTRE_MAP[typeRaw ?? ''] ?? 'conseilMinistres';

    // Code rencontre : synthétique basé sur type + date si absent
    const codeRenc =
      normalizeString(pickColumn(r, 'CODE RENCONTRE')) ??
      `${typeRencontre.slice(0, 3).toUpperCase()}-${dateRenc.replace(/-/g, '')}`;

    // Intitulé : synthétique basé sur la date si absent
    const intitule =
      normalizeString(pickColumn(r, 'RENCONTRE', 'INTITULE', 'INTITULÉ')) ??
      `Rencontre du ${dateRenc}`;

    // Code directive : synthétique basé sur index si absent
    const codeDir =
      normalizeString(pickColumn(r, 'CODE DIRECTIVE', 'CODE DIR')) ??
      `MD-${String(idx + 1).padStart(4, '0')}-${dateRenc.replace(/-/g, '')}`;

    let rencontreId = rencCache.get(codeRenc);
    if (!rencontreId) {
      const existing = await queryOne<{ id: string }>(
        `SELECT "id" FROM "rencontres" WHERE "codeRencontre" = $1`,
        [codeRenc],
      );
      if (existing) {
        rencontreId = existing.id;
      } else {
        if (opts.dryRun) {
          rencontreId = `dryrun-${codeRenc}`;
        } else {
          const annee =
            normalizeInt(pickColumn(r, 'ANNEE', 'ANNÉE', 'YEAR')) ??
            Number(dateRenc.slice(0, 4));
          const created = await queryOne<{ id: string }>(
            `INSERT INTO "rencontres" ("typeRencontre", "codeRencontre", "intitule", "dateRencontre", "annee")
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT ("codeRencontre") DO UPDATE SET "intitule" = EXCLUDED."intitule"
             RETURNING "id"`,
            [typeRencontre, codeRenc, intitule, dateRenc, annee],
          );
          rencontreId = created?.id;
        }
        if (rencontreId) rencCount++;
      }
      if (rencontreId) rencCache.set(codeRenc, rencontreId);
    }
    if (!rencontreId) continue;

    const exists = await queryOne<{ id: string }>(
      `SELECT "id" FROM "directives" WHERE "codeDirective" = $1`,
      [codeDir],
    );
    if (exists) continue;

    const etat = ETAT_MAP[normalizeString(pickColumn(r, 'ETAT', 'ÉTAT', 'STATE')) ?? ''] ?? 'attente';
    const echeance = normalizeDate(pickColumn(r, 'ECHEANCE', 'ÉCHÉANCE'));
    const debutExecution = normalizeDate(pickColumn(r, 'DEBUT EXECUTION', 'DÉBUT EXÉCUTION', 'DEBUT'));
    const finExecution = normalizeDate(pickColumn(r, 'FIN EXECUTION', 'FIN EXÉCUTION', 'FIN'));
    const joursPrevu = normalizeInt(
      pickColumn(r, 'NOMBRE JOUR DE TRAITEMENT PREVU', 'NOMBRE JOUR DE TRAITEMENT PRÉVU', 'JOURS PREVU'),
    );
    const joursReel = normalizeInt(
      pickColumn(r, 'NOMBRE JOUR DE TRAITEMENT REEL', 'NOMBRE JOUR DE TRAITEMENT RÉEL', 'JOURS REEL'),
    );
    const joursRetardDemarrage = normalizeInt(
      pickColumn(r, 'NOMBRE JOUR RETARD DEMARRAGE', 'NOMBRE JOUR RETARD DÉMARRAGE', 'JOURS RETARD'),
    );
    const derniereDateTraitement = normalizeDate(
      pickColumn(r, 'Dernière date Traitement', 'DERNIERE DATE TRAITEMENT'),
    );
    const commentaires = normalizeString(pickColumn(r, 'Commentaires', 'COMMENTAIRES'));
    const typeCause = normalizeString(pickColumn(r, 'TYPE CAUSE', 'CAUSE'));
    const ministeresRaw =
      normalizeString(pickColumn(r, 'MINISTERES ASSOCIES', 'MINISTÈRES ASSOCIÉS', 'MINISTERES')) ??
      '';
    const ministeres = ministeresRaw
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);

    if (!opts.dryRun) {
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
    }
    dirCount++;
  }

  return { rencontres: rencCount, directives: dirCount };
}

async function migrateCopil(
  workbook: XLSX.WorkBook,
  opts: { dryRun?: boolean } = {},
): Promise<number> {
  const sheet = workbook.Sheets['Suivi Recom Copil'];
  if (!sheet) return 0;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  let currentType: string | null = null;
  let inserted = 0;

  for (const row of rows) {
    const col1 = normalizeString(row[0]);
    const col2 = normalizeString(row[1]);
    if (!col2 && !col1) continue;

    if (col2 && !col1 && COPIL_NAME_MAP[col2.toUpperCase()]) {
      currentType = COPIL_NAME_MAP[col2.toUpperCase()] ?? null;
      continue;
    }

    if (currentType && col1 && col2) {
      const num = Number(col1);
      if (!Number.isFinite(num)) continue;
      const exists = await queryOne<{ id: string }>(
        `SELECT "id" FROM "recommandationsMatrice" WHERE "typeMatrice" = $1 AND "numOrdre" = $2`,
        [currentType, num],
      );
      if (exists) continue;
      if (!opts.dryRun) {
        await query(
          `INSERT INTO "recommandationsMatrice" ("typeMatrice", "numOrdre", "texteRecommandation", "etat")
           VALUES ($1, $2, $3, 'attente')`,
          [currentType, num, col2],
        );
      }
      inserted++;
    }
  }
  return inserted;
}

async function migrateCngi(
  workbook: XLSX.WorkBook,
  opts: { dryRun?: boolean } = {},
): Promise<number> {
  const sheet = workbook.Sheets['Suivi Recom CNGI'];
  if (!sheet) return 0;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  let inserted = 0;
  let numOrdre = 0;
  for (const row of rows) {
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
    if (!opts.dryRun) {
      await query(
        `INSERT INTO "recommandationsMatrice" ("typeMatrice", "numOrdre", "texteRecommandation", "etat")
         VALUES ('cngi', $1, $2, 'attente')`,
        [numOrdre, texte],
      );
    }
    inserted++;
  }
  return inserted;
}

async function migrateReformeAssainissement(
  workbook: XLSX.WorkBook,
  opts: { dryRun?: boolean } = {},
): Promise<number> {
  const sheet = workbook.Sheets["Réf sur l'ASS"];
  if (!sheet) return 0;
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
    if (!opts.dryRun) {
      await query(
        `INSERT INTO "recommandationsMatrice" ("typeMatrice", "numOrdre", "texteRecommandation", "etat")
         VALUES ('reformeAssainissement', $1, $2, 'attente')`,
        [numOrdre, texte],
      );
    }
    inserted++;
  }
  return inserted;
}

async function migrateReformeInstitutionnelle(
  workbook: XLSX.WorkBook,
  opts: { dryRun?: boolean } = {},
): Promise<number> {
  const sheet = workbook.Sheets['Sui FeuilleR Ref Inst'];
  if (!sheet) return 0;
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
    const priority = priorite?.toLowerCase().match(/^(urgent|prioritaire|obligatoire)$/)
      ? priorite.toLowerCase()
      : 'standard';
    const exists = await queryOne<{ id: string }>(
      `SELECT "id" FROM "recommandationsMatrice" WHERE "typeMatrice" = 'reformeInstitutionnelle' AND "numOrdre" = $1`,
      [numOrdre],
    );
    if (exists) continue;
    if (!opts.dryRun) {
      await query(
        `INSERT INTO "recommandationsMatrice" ("typeMatrice", "numOrdre", "texteRecommandation", "etat", "echeanceTrimestre", "priorite")
         VALUES ('reformeInstitutionnelle', $1, $2, 'attente', $3, $4)`,
        [numOrdre, activite, trimestre, priority],
      );
    }
    inserted++;
  }
  return inserted;
}

async function migrateReunions(
  workbook: XLSX.WorkBook,
  opts: { dryRun?: boolean } = {},
): Promise<number> {
  // Format historique : header=1 + colonnes positionnelles. Le sheet "Suivi Rtechnique"
  // n'a pas d'en-tête nommé donc on lit en mode tableau brut.
  const sheet = workbook.Sheets['Suivi Rtechnique'];
  if (!sheet) return 0;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  let inserted = 0;
  for (const row of rows) {
    const date = normalizeDate(row[0]);
    const theme = normalizeString(row[1]);
    if (!date || !theme) continue;
    if (theme === 'Théme' || theme === 'Date' || theme === 'Theme') continue;

    const exists = await queryOne<{ id: string }>(
      `SELECT "id" FROM "reunionsTechniques" WHERE "dateReunion" = $1 AND "theme" = $2 LIMIT 1`,
      [date, theme],
    );
    if (exists) continue;

    const sousSecteur = inferSousSecteur(`${theme} ${normalizeString(row[2]) ?? ''}`);
    const copilLie = inferCopil(`${theme} ${normalizeString(row[2]) ?? ''}`);

    if (!opts.dryRun) {
      await query(
        `INSERT INTO "reunionsTechniques" ("dateReunion", "theme", "participants", "sousSecteur", "copilLie")
         VALUES ($1, $2, '[]'::jsonb, $3, $4)`,
        [date, theme, sousSecteur, copilLie],
      );
    }
    inserted++;
  }
  return inserted;
}

// ---------------------------------------------------------------------------
// Migrations format EXPORT (roundtrip)
// ---------------------------------------------------------------------------

/**
 * Construit une map { label -> code } à partir des référentiels typeMatrice
 * pour résoudre la colonne "Matrice" du format export.
 */
async function loadMatriceLabelMap(): Promise<Map<string, string>> {
  const rows = await queryAll<{ code: string; label: string }>(
    `SELECT "code", "label" FROM "referentiels" WHERE "codeType" = 'typeMatrice'`,
  );
  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(r.label.trim().toLowerCase(), r.code);
    map.set(r.code.toLowerCase(), r.code);
  }
  return map;
}

/**
 * Lit la feuille "Recommandations" du format export (à plat) où chaque ligne
 * porte sa colonne Matrice (label). Convertit le label en code via le référentiel.
 */
async function migrateRecommandationsFlat(
  workbook: XLSX.WorkBook,
  opts: { dryRun?: boolean } = {},
): Promise<number> {
  const sheet = workbook.Sheets['Recommandations'];
  if (!sheet) return 0;
  const rows = XLSX.utils.sheet_to_json<UnknownRow>(sheet, { defval: null });
  if (rows.length === 0) return 0;

  const labelMap = await loadMatriceLabelMap();
  let inserted = 0;

  for (const r of rows) {
    const matriceLabel = normalizeString(r['Matrice']);
    const numOrdre = normalizeInt(r['N° ordre']);
    const texte = normalizeString(r['Recommandation']);
    if (!matriceLabel || numOrdre === null || !texte) continue;

    const code = labelMap.get(matriceLabel.trim().toLowerCase());
    if (!code) continue;

    const exists = await queryOne<{ id: string }>(
      `SELECT "id" FROM "recommandationsMatrice" WHERE "typeMatrice" = $1 AND "numOrdre" = $2`,
      [code, numOrdre],
    );
    if (exists) continue;

    const etat = ETAT_MAP[normalizeString(r['État']) ?? ''] ?? 'attente';
    const echeance = normalizeString(r['Échéance trim.']);
    const trimestre = echeance && /^T[1-4]$/i.test(echeance) ? echeance.toUpperCase() : null;
    const priorite = normalizeString(r['Priorité']);
    const observations = normalizeString(r['Observations']);

    if (!opts.dryRun) {
      await query(
        `INSERT INTO "recommandationsMatrice"
           ("typeMatrice", "numOrdre", "texteRecommandation", "etat", "echeanceTrimestre", "priorite", "observations")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [code, numOrdre, texte, etat, trimestre, priorite, observations],
      );
    }
    inserted++;
  }
  return inserted;
}

/**
 * Alias pour la feuille "Réunions techniques" du format export (avec en-têtes nommés).
 */
async function migrateReunionsExport(
  workbook: XLSX.WorkBook,
  opts: { dryRun?: boolean } = {},
): Promise<number> {
  const sheet = workbook.Sheets['Réunions techniques'];
  if (!sheet) return 0;
  const rows = XLSX.utils.sheet_to_json<UnknownRow>(sheet, { defval: null });
  let inserted = 0;

  for (const r of rows) {
    const date = normalizeDate(r['Date']);
    const theme = normalizeString(r['Thème']);
    if (!date || !theme) continue;

    const exists = await queryOne<{ id: string }>(
      `SELECT "id" FROM "reunionsTechniques" WHERE "dateReunion" = $1 AND "theme" = $2 LIMIT 1`,
      [date, theme],
    );
    if (exists) continue;

    const sousSecteur =
      normalizeString(r['Sous-secteur']) ?? inferSousSecteur(theme);
    const copilLie = normalizeString(r['COPIL rattaché']) ?? inferCopil(theme);
    const typeReunion = normalizeString(r['Type de réunion']);
    const lieu = normalizeString(r['Lieu']);
    const heureDebut = normalizeString(r['Heure']);
    const dureeEstimee = normalizeString(r['Durée']);
    const ordreDuJour = normalizeString(r['Ordre du jour']);
    const decisions = normalizeString(r['Décisions']);
    const participantsRaw = normalizeString(r['Participants']) ?? '';
    const participants = participantsRaw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    if (!opts.dryRun) {
      await query(
        `INSERT INTO "reunionsTechniques"
           ("dateReunion", "heureDebut", "dureeEstimee", "theme", "lieu",
            "sousSecteur", "copilLie", "typeReunion",
            "ordreDuJour", "decisions", "participants")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
        [
          date,
          heureDebut,
          dureeEstimee,
          theme,
          lieu,
          sousSecteur,
          copilLie,
          typeReunion,
          ordreDuJour,
          decisions,
          JSON.stringify(participants),
        ],
      );
    }
    inserted++;
  }
  return inserted;
}

/**
 * Lit la feuille "Missions terrain" du format export.
 */
async function migrateMissions(
  workbook: XLSX.WorkBook,
  opts: { dryRun?: boolean } = {},
): Promise<number> {
  const sheet = workbook.Sheets['Missions terrain'];
  if (!sheet) return 0;
  const rows = XLSX.utils.sheet_to_json<UnknownRow>(sheet, { defval: null });
  let inserted = 0;

  for (const r of rows) {
    const date = normalizeDate(r['Date']);
    const localite = normalizeString(r['Localité']);
    if (!date || !localite) continue;

    const exists = await queryOne<{ id: string }>(
      `SELECT "id" FROM "missionsTerrain"
       WHERE "dateMission" = $1 AND "localite" = $2 LIMIT 1`,
      [date, localite],
    );
    if (exists) continue;

    const region = normalizeString(r['Région']);
    const latRaw = r['Latitude'];
    const lonRaw = r['Longitude'];
    const latitude = latRaw === null || latRaw === '' ? null : Number(latRaw);
    const longitude = lonRaw === null || lonRaw === '' ? null : Number(lonRaw);
    const projetRattache = normalizeString(r['Projet rattaché']);
    const constats = normalizeString(r['Constats']);
    const recommandations = normalizeString(r['Recommandations']);

    if (!opts.dryRun) {
      await query(
        `INSERT INTO "missionsTerrain"
           ("dateMission", "localite", "region", "latitude", "longitude",
            "projetRattache", "constats", "recommandations")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          date,
          localite,
          region,
          Number.isFinite(latitude as number) ? latitude : null,
          Number.isFinite(longitude as number) ? longitude : null,
          projetRattache,
          constats,
          recommandations,
        ],
      );
    }
    inserted++;
  }
  return inserted;
}

/**
 * Lit les feuilles "par projet" du format export 'projets' (une feuille par COPIL).
 * Identifie une feuille comme "feuille projet" si son nom matche un label de
 * référentiel typeMatrice (parentCode='copil'). Chaque feuille a un titre row 1
 * fusionné + en-tête row 2.
 */
async function migrateProjetsSheets(
  workbook: XLSX.WorkBook,
  opts: { dryRun?: boolean } = {},
): Promise<number> {
  const projets = await queryAll<{ code: string; label: string }>(
    `SELECT "code", "label"
     FROM "referentiels"
     WHERE "codeType" = 'typeMatrice'
       AND (COALESCE("parentCode", '') = 'copil' OR "code" LIKE 'copil%')`,
  );
  if (projets.length === 0) return 0;

  const labelToCode = new Map<string, string>();
  for (const p of projets) {
    const safeName = p.label.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
    labelToCode.set(safeName, p.code);
  }

  let inserted = 0;
  for (const sheetName of workbook.SheetNames) {
    const code = labelToCode.get(sheetName);
    if (!code) continue;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    // Lit en sautant la ligne de titre (range: 1 => en-têtes en ligne 2, 0-indexed = 1).
    const rows = XLSX.utils.sheet_to_json<UnknownRow>(sheet, { range: 1, defval: null });

    for (const r of rows) {
      const numOrdre = normalizeInt(r['N° ordre']);
      const texte = normalizeString(r['Recommandation']);
      if (numOrdre === null || !texte) continue;

      const exists = await queryOne<{ id: string }>(
        `SELECT "id" FROM "recommandationsMatrice" WHERE "typeMatrice" = $1 AND "numOrdre" = $2`,
        [code, numOrdre],
      );
      if (exists) continue;

      const etat = ETAT_MAP[normalizeString(r['État']) ?? ''] ?? 'attente';
      const echeance = normalizeString(r['Échéance trim.']);
      const trimestre = echeance && /^T[1-4]$/i.test(echeance) ? echeance.toUpperCase() : null;
      const priorite = normalizeString(r['Priorité']);
      const observations = normalizeString(r['Observations']);

      if (!opts.dryRun) {
        await query(
          `INSERT INTO "recommandationsMatrice"
             ("typeMatrice", "numOrdre", "texteRecommandation", "etat", "echeanceTrimestre", "priorite", "observations")
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [code, numOrdre, texte, etat, trimestre, priorite, observations],
        );
      }
      inserted++;
    }
  }
  return inserted;
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

export interface ImportSummary {
  rencontres: number;
  directives: number;
  copil: number;
  cngi: number;
  reformeAssainissement: number;
  reformeInstitutionnelle: number;
  recommandationsFlat: number;
  projetsSheets: number;
  reunions: number;
  interpellations: number;
  deputes: number;
  sessions: number;
  directions: number;
  referentiels: number;
  missions: number;
}

// ---------------------------------------------------------------------------
// Mode DIRECTIVES UNIQUEMENT — lit strictement le 1er onglet
// ---------------------------------------------------------------------------

export interface DirectivesOnlyImportSummary {
  filename?: string;
  totalRows: number;          // lignes totales analysées
  imported: number;            // nouvelles directives insérées
  duplicatesSkipped: number;   // lignes ignorées car codeDirective déjà en base
  skippedNoText: number;       // lignes ignorées car texte manquant
  rencontresCreated: number;   // rencontres synthétiques créées
}

/**
 * Mode STRICT "Importer Directives" — lit le 1er onglet uniquement,
 * sans fallback PLAN, sans détection d'autres feuilles.
 *
 * Cle de deduplication : CODE DIRECTIVE si présent. Sinon hash SHA1
 * stable basé sur le texte de la directive (les memes textes
 * produisent le meme code → idempotence garantie).
 *
 * Génère une rencontre synthétique unique par date trouvée pour
 * rattacher les directives.
 */
export async function importDirectivesFirstSheet(
  buffer: Buffer,
  opts: { dryRun?: boolean } = {},
): Promise<DirectivesOnlyImportSummary> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return {
      totalRows: 0,
      imported: 0,
      duplicatesSkipped: 0,
      skippedNoText: 0,
      rencontresCreated: 0,
    };
  }
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    return {
      totalRows: 0,
      imported: 0,
      duplicatesSkipped: 0,
      skippedNoText: 0,
      rencontresCreated: 0,
    };
  }

  const headerRange = detectHeaderRow(sheet);
  const rows = XLSX.utils.sheet_to_json<UnknownRow>(sheet, { range: headerRange });

  let imported = 0;
  let duplicatesSkipped = 0;
  let skippedNoText = 0;
  let rencontresCreated = 0;
  const rencCache = new Map<string, string>();

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    if (!r) continue;

    const texteDir = normalizeString(pickColumn(r, 'DIRECTIVES', 'DIRECTIVE', 'Directive'));
    if (!texteDir) {
      skippedNoText++;
      continue;
    }

    // === Clé de déduplication : CODE DIRECTIVE en priorité ===
    const codeDirRaw = normalizeString(pickColumn(r, 'CODE DIRECTIVE', 'CODE DIR'));
    const codeDir =
      codeDirRaw ?? `MD-AUTO-${crypto.createHash('sha1').update(texteDir).digest('hex').slice(0, 12).toUpperCase()}`;

    // === Détection de doublon par codeDirective ===
    const exists = await queryOne<{ id: string }>(
      `SELECT "id" FROM "directives" WHERE "codeDirective" = $1`,
      [codeDir],
    );
    if (exists) {
      duplicatesSkipped++;
      continue;
    }

    // === Date pour rattacher la directive à une rencontre ===
    const dateRenc =
      normalizeDate(pickColumn(r, 'DATE RENCONTRE', 'DATE RECONTRE', 'DATE')) ??
      normalizeDate(pickColumn(r, 'ECHEANCE')) ??
      new Date().toISOString().slice(0, 10);

    // === Rencontre synthétique : une par date ===
    let rencontreId = rencCache.get(dateRenc);
    if (!rencontreId) {
      const codeRenc = `IMP-${dateRenc.replace(/-/g, '')}`;
      const existingRenc = await queryOne<{ id: string }>(
        `SELECT "id" FROM "rencontres" WHERE "codeRencontre" = $1`,
        [codeRenc],
      );
      if (existingRenc) {
        rencontreId = existingRenc.id;
      } else if (opts.dryRun) {
        rencontreId = `dryrun-${codeRenc}`;
      } else {
        const annee = Number(dateRenc.slice(0, 4));
        const created = await queryOne<{ id: string }>(
          `INSERT INTO "rencontres" ("typeRencontre", "codeRencontre", "intitule", "dateRencontre", "annee")
           VALUES ('conseilMinistres', $1, $2, $3, $4)
           ON CONFLICT ("codeRencontre") DO UPDATE SET "intitule" = EXCLUDED."intitule"
           RETURNING "id"`,
          [codeRenc, `Import du ${dateRenc}`, dateRenc, annee],
        );
        rencontreId = created?.id;
        if (rencontreId) rencontresCreated++;
      }
      if (rencontreId) rencCache.set(dateRenc, rencontreId);
    }
    if (!rencontreId) continue;

    // === Champs optionnels ===
    const etat = ETAT_MAP[normalizeString(pickColumn(r, 'ETAT', 'ÉTAT')) ?? ''] ?? 'attente';
    const echeance = normalizeDate(pickColumn(r, 'ECHEANCE', 'ÉCHÉANCE'));
    const debutExecution = normalizeDate(pickColumn(r, 'DEBUT EXECUTION', 'DÉBUT EXÉCUTION'));
    const finExecution = normalizeDate(pickColumn(r, 'FIN EXECUTION', 'FIN EXÉCUTION'));
    const joursPrevu = normalizeInt(pickColumn(r, 'NOMBRE JOUR DE TRAITEMENT PREVU', 'JOURS PREVU'));
    const joursReel = normalizeInt(pickColumn(r, 'NOMBRE JOUR DE TRAITEMENT REEL', 'JOURS REEL'));
    const joursRetardDemarrage = normalizeInt(
      pickColumn(r, 'NOMBRE JOUR RETARD DEMARRAGE', 'JOURS RETARD'),
    );
    const typeCause = normalizeString(pickColumn(r, 'TYPE CAUSE', 'CAUSE'));
    const commentaires = normalizeString(pickColumn(r, 'Commentaires', 'COMMENTAIRES'));
    const ministeresRaw =
      normalizeString(pickColumn(r, 'MINISTERES ASSOCIES', 'MINISTÈRES ASSOCIÉS')) ?? '';
    const ministeres = ministeresRaw
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);

    if (!opts.dryRun) {
      await query(
        `INSERT INTO "directives" (
           "rencontreId", "codeDirective", "texteDirective", "ministeresAssocies",
           "echeance", "debutExecution", "finExecution", "etat", "typeCause",
           "joursPrevu", "joursReel", "joursRetardDemarrage", "commentaires",
           "statutValidation"
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'valide')`,
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
          commentaires,
        ],
      );
    }
    imported++;
  }

  return {
    totalRows: rows.length,
    imported,
    duplicatesSkipped,
    skippedNoText,
    rencontresCreated,
  };
}

// ---------------------------------------------------------------------------
// Schéma des colonnes attendues par type d'import — défini explicitement
// pour que l'utilisateur voie ce qui est requis et puisse vérifier le mapping.
// ---------------------------------------------------------------------------

export interface ExpectedColumn {
  role: string;        // identifiant interne (ex: 'depute', 'titre')
  label: string;       // libellé affiché à l'utilisateur
  candidates: string[]; // noms de colonnes acceptés dans le fichier
  required: boolean;
}

export const COLUMN_EXPECTATIONS = {
  interpellations: [
    {
      role: 'depute',
      label: 'Député (nom complet)',
      candidates: ['Nom des Députés', 'Députés', 'Deputes', 'Député', 'Depute', 'NOM'],
      required: true,
    },
    {
      role: 'titre',
      label: 'Question / Intitulé',
      candidates: ['Questions', 'Question', 'Intitulé', 'Intitule', 'INTITULE', 'Titre'],
      required: true,
    },
    {
      role: 'localite',
      label: 'Localité',
      candidates: ['Localité', 'Localite', 'LIEU', 'Lieu'],
      required: false,
    },
    {
      role: 'sousSecteur',
      label: 'Domaine / Thématique',
      candidates: ['Domaine/Thématique', 'Domaine', 'Thématique', 'Sous-secteur', 'SOUS-SECTEUR'],
      required: false,
    },
    {
      role: 'structureResp',
      label: 'Structure responsable',
      candidates: ['Structure Resp', 'Structure', 'Responsable'],
      required: false,
    },
  ],
  'missions-terrain': [
    {
      role: 'localite',
      label: 'Localité',
      candidates: ['Localité', 'Localite', 'LIEU', 'LIEUX', 'Lieu'],
      required: true,
    },
    {
      role: 'date',
      label: 'Date de la mission',
      candidates: ['Date', 'Date mission', 'DATE'],
      required: true,
    },
    {
      role: 'description',
      label: "Description de l'activité",
      candidates: ["Description de l'activité", 'Description', 'Activité', 'Constats'],
      required: false,
    },
    {
      role: 'region',
      label: 'Région',
      candidates: ['Région', 'Region'],
      required: false,
    },
    {
      role: 'projet',
      label: 'Projet rattaché',
      candidates: ['Projet rattaché', 'Projet', 'COPIL'],
      required: false,
    },
  ],
} as const satisfies Record<string, readonly ExpectedColumn[]>;

export type ImportMode = keyof typeof COLUMN_EXPECTATIONS;

/**
 * Pour une feuille donnée, vérifie quelles colonnes attendues du mode sont
 * effectivement présentes. Retourne un mapping role → nom_colonne_trouvée
 * (ou null si non trouvée).
 */
export function checkColumnMapping(
  headers: string[],
  mode: ImportMode,
): Record<string, string | null> {
  const expected = COLUMN_EXPECTATIONS[mode];
  const mapping: Record<string, string | null> = {};
  for (const exp of expected) {
    let found: string | null = null;
    for (const cand of exp.candidates) {
      const match = headers.find((h) => h.toUpperCase().trim() === cand.toUpperCase().trim());
      if (match) {
        found = match;
        break;
      }
    }
    mapping[exp.role] = found;
  }
  return mapping;
}

// ---------------------------------------------------------------------------
// Inspection interactive — utilisée par les imports dédiés (interpellations,
// missions) pour proposer à l'utilisateur la feuille à importer.
// ---------------------------------------------------------------------------

export interface SheetPreview {
  name: string;
  rowCount: number;
  headers: string[];
  sampleRows: Array<Record<string, string | number | null>>;
  suggestedHeaderRow: number;
}

export function inspectWorkbook(buffer: Buffer): SheetPreview[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    if (!sheet) {
      return { name, rowCount: 0, headers: [], sampleRows: [], suggestedHeaderRow: 0 };
    }
    const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });

    // Cherche la 1ère ligne avec ≥ 2 cellules non vides (heuristique header)
    let suggestedHeaderRow = 0;
    for (let i = 0; i < Math.min(allRows.length, 10); i++) {
      const row = allRows[i];
      if (Array.isArray(row) && row.filter((c) => c !== null && String(c).trim() !== '').length >= 2) {
        suggestedHeaderRow = i;
        break;
      }
    }

    const headerRow = allRows[suggestedHeaderRow] ?? [];
    const headers = (Array.isArray(headerRow) ? headerRow : [])
      .map((c, i) => (c !== null && String(c).trim() !== '' ? String(c).trim() : `col_${i + 1}`));

    // 3 premières lignes de data
    const sampleRows: Array<Record<string, string | number | null>> = [];
    for (let i = suggestedHeaderRow + 1; i < Math.min(allRows.length, suggestedHeaderRow + 4); i++) {
      const row = allRows[i];
      if (!Array.isArray(row)) continue;
      const record: Record<string, string | number | null> = {};
      headers.forEach((h, idx) => {
        const val = row[idx];
        if (val === null || val === undefined) record[h] = null;
        else if (typeof val === 'number') record[h] = val;
        else record[h] = String(val).slice(0, 100);
      });
      sampleRows.push(record);
    }

    return {
      name,
      rowCount: Math.max(0, allRows.length - suggestedHeaderRow - 1),
      headers,
      sampleRows,
      suggestedHeaderRow,
    };
  });
}

// ---------------------------------------------------------------------------
// Imports dédiés — feuille choisie explicitement par l'utilisateur
// ---------------------------------------------------------------------------

export interface DedicatedImportSummary {
  totalRows: number;
  imported: number;
  duplicatesSkipped: number;
  skippedInvalid: number;
}

/**
 * Importe les interpellations depuis une feuille choisie par l'utilisateur.
 * Détecte/crée les députés à la volée s'ils n'existent pas.
 */
export async function importInterpellationsFromSheet(
  buffer: Buffer,
  sheetName: string,
  opts: { dryRun?: boolean } = {},
): Promise<DedicatedImportSummary> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { totalRows: 0, imported: 0, duplicatesSkipped: 0, skippedInvalid: 0 };
  }
  const headerRange = detectGenericHeaderRow(sheet);
  const rows = XLSX.utils.sheet_to_json<UnknownRow>(sheet, { range: headerRange });

  let imported = 0;
  let duplicatesSkipped = 0;
  let skippedInvalid = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    if (!r) continue;

    const intitule = normalizeString(
      pickColumn(r, 'Questions', 'Question', 'Intitulé', 'Intitule', 'INTITULE'),
    );
    const deputeNom = normalizeString(
      pickColumn(r, 'Nom des Députés', 'Députés', 'Deputes', 'Député', 'Depute', 'NOM'),
    );

    if (!intitule || !deputeNom) {
      skippedInvalid++;
      continue;
    }

    // Trouve ou crée le député (groupeParlementaire NOT NULL → défaut 'Inconnu')
    let deputeId: string | null = null;
    const existingDepute = await queryOne<{ id: string }>(
      `SELECT "id" FROM "deputes" WHERE LOWER("nomComplet") = LOWER($1) LIMIT 1`,
      [deputeNom],
    );
    if (existingDepute) {
      deputeId = existingDepute.id;
    } else if (!opts.dryRun) {
      const created = await queryOne<{ id: string }>(
        `INSERT INTO "deputes" ("nomComplet", "groupeParlementaire") VALUES ($1, 'Non renseigne') RETURNING "id"`,
        [deputeNom],
      );
      deputeId = created?.id ?? null;
    }

    // Déduplication : (deputeId, titre)
    if (deputeId) {
      const exists = await queryOne<{ id: string }>(
        `SELECT "id" FROM "interpellations"
         WHERE "deputeId" = $1 AND "titre" = $2 LIMIT 1`,
        [deputeId, intitule],
      );
      if (exists) {
        duplicatesSkipped++;
        continue;
      }
    }

    const localite = normalizeString(pickColumn(r, 'Localité', 'Localite', 'LIEU'));
    const sousSecteur = normalizeString(
      pickColumn(r, 'Domaine/Thématique', 'Domaine', 'Thématique', 'Sous-secteur', 'SOUS-SECTEUR'),
    );
    const structureResp = normalizeString(
      pickColumn(r, 'Structure Resp', 'Structure', 'Responsable'),
    );

    // Construit la description en agrégeant localité + domaine + structure
    const descParts: string[] = [];
    if (localite) descParts.push(`Localité : ${localite}`);
    if (sousSecteur) descParts.push(`Domaine : ${sousSecteur}`);
    if (structureResp) descParts.push(`Structure responsable : ${structureResp}`);
    const description = descParts.length > 0 ? descParts.join(' · ') : null;

    // Référence synthétique unique pour suivi (timestamp + index pour éviter collision)
    const ts = Date.now().toString(36).slice(-6).toUpperCase();
    const reference = `IMP-${ts}-${String(idx + 1).padStart(3, '0')}`;

    if (!opts.dryRun && deputeId) {
      await query(
        `INSERT INTO "interpellations"
           ("typeInterpellation", "titre", "reference", "deputeId",
            "description", "dateReception", "etat")
         VALUES ('ecrite', $1, $2, $3, $4, CURRENT_DATE, 'recue')`,
        [intitule, reference, deputeId, description],
      );
    }
    imported++;
  }

  return { totalRows: rows.length, imported, duplicatesSkipped, skippedInvalid };
}

/**
 * Importe les missions terrain depuis une feuille choisie par l'utilisateur.
 */
export async function importMissionsFromSheet(
  buffer: Buffer,
  sheetName: string,
  opts: { dryRun?: boolean } = {},
): Promise<DedicatedImportSummary> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { totalRows: 0, imported: 0, duplicatesSkipped: 0, skippedInvalid: 0 };
  }
  const headerRange = detectGenericHeaderRow(sheet);
  const rows = XLSX.utils.sheet_to_json<UnknownRow>(sheet, { range: headerRange });

  let imported = 0;
  let duplicatesSkipped = 0;
  let skippedInvalid = 0;

  for (const r of rows) {
    if (!r) continue;
    const localite = normalizeString(
      pickColumn(r, 'Localité', 'Localite', 'LIEU', 'LIEUX', 'Lieu'),
    );
    const date = normalizeDate(
      pickColumn(r, 'Date', 'Date mission', 'DATE'),
    );
    if (!localite || !date) {
      skippedInvalid++;
      continue;
    }

    // Déduplication : (date, localite)
    const exists = await queryOne<{ id: string }>(
      `SELECT "id" FROM "missionsTerrain"
       WHERE "dateMission" = $1 AND "localite" = $2 LIMIT 1`,
      [date, localite],
    );
    if (exists) {
      duplicatesSkipped++;
      continue;
    }

    const constats = normalizeString(
      pickColumn(r, "Description de l'activité", 'Description', 'Activité', 'Constats'),
    );
    const region = normalizeString(pickColumn(r, 'Région', 'Region'));
    const projetRattache = normalizeString(
      pickColumn(r, 'Projet rattaché', 'Projet', 'COPIL'),
    );

    if (!opts.dryRun) {
      await query(
        `INSERT INTO "missionsTerrain"
           ("dateMission", "localite", "region", "projetRattache", "constats")
         VALUES ($1, $2, $3, $4, $5)`,
        [date, localite, region, projetRattache, constats],
      );
    }
    imported++;
  }

  return { totalRows: rows.length, imported, duplicatesSkipped, skippedInvalid };
}

// ---------------------------------------------------------------------------
// Migrations BACKUP COMPLET (feuilles supplémentaires du backup réimportable)
// ---------------------------------------------------------------------------

async function migrateInterpellations(
  workbook: XLSX.WorkBook,
  opts: { dryRun?: boolean } = {},
): Promise<number> {
  const sheet = workbook.Sheets['Interpellations'];
  if (!sheet) return 0;
  const rows = XLSX.utils.sheet_to_json<UnknownRow>(sheet, { defval: null });
  let inserted = 0;
  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    if (!r) continue;
    const titre = normalizeString(
      pickColumn(r, 'Titre', 'Intitulé', 'Intitule', 'INTITULE'),
    );
    const typeRaw = normalizeString(
      pickColumn(r, 'Type', 'Type interpellation', 'TYPE'),
    );
    if (!titre) continue;

    // Normalise le type : seules valeurs acceptées par le CHECK = orale/ecrite/commission
    const type =
      typeRaw && ['orale', 'ecrite', 'commission'].includes(typeRaw.toLowerCase())
        ? typeRaw.toLowerCase()
        : 'ecrite';

    const refRaw = normalizeString(pickColumn(r, 'Référence', 'Reference', 'REFERENCE'));
    const ts = Date.now().toString(36).slice(-6).toUpperCase();
    const reference = refRaw ?? `IMP-${ts}-${String(idx + 1).padStart(3, '0')}`;

    const existing = await queryOne<{ id: string }>(
      `SELECT "id" FROM "interpellations" WHERE "reference" = $1 LIMIT 1`,
      [reference],
    );
    if (existing) continue;

    // Cherche le député (requis : NOT NULL)
    const deputeName = normalizeString(pickColumn(r, 'Député', 'Depute', 'Nom député'));
    if (!deputeName) continue;
    const depute = await queryOne<{ id: string }>(
      `SELECT "id" FROM "deputes" WHERE LOWER("nomComplet") = LOWER($1) LIMIT 1`,
      [deputeName],
    );
    if (!depute) continue; // sans député en base, on skip

    const dateReception =
      normalizeDate(pickColumn(r, 'Date réception', 'Date reception', 'Date', 'DATE')) ??
      new Date().toISOString().slice(0, 10);
    const etat = normalizeString(pickColumn(r, 'État', 'Etat', 'ETAT')) ?? 'recue';
    const dateReponse = normalizeDate(pickColumn(r, 'Date réponse', 'Date reponse'));
    const description = normalizeString(
      pickColumn(r, 'Description', 'Contenu', 'CONTENU'),
    );
    const texteReponse = normalizeString(pickColumn(r, 'Texte réponse', 'Texte reponse'));
    if (!opts.dryRun) {
      await query(
        `INSERT INTO "interpellations"
           ("typeInterpellation", "titre", "reference", "deputeId", "description",
            "dateReception", "etat", "dateReponse", "texteReponse")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          type,
          titre,
          reference,
          depute.id,
          description,
          dateReception,
          etat,
          dateReponse,
          texteReponse,
        ],
      );
    }
    inserted++;
  }
  return inserted;
}

async function migrateDeputes(
  workbook: XLSX.WorkBook,
  opts: { dryRun?: boolean } = {},
): Promise<number> {
  const sheet = workbook.Sheets['Députés'] ?? workbook.Sheets['Deputes'];
  if (!sheet) return 0;
  const rows = XLSX.utils.sheet_to_json<UnknownRow>(sheet, { defval: null });
  let inserted = 0;
  for (const r of rows) {
    const nomComplet = normalizeString(pickColumn(r, 'Nom complet', 'Nom', 'NOM COMPLET'));
    if (!nomComplet) continue;
    const existing = await queryOne<{ id: string }>(
      `SELECT "id" FROM "deputes" WHERE "nomComplet" = $1 LIMIT 1`,
      [nomComplet],
    );
    if (existing) continue;
    if (!opts.dryRun) {
      await query(
        `INSERT INTO "deputes" ("nomComplet", "sexe", "groupeParlementaire", "region", "email", "telephone")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          nomComplet,
          normalizeString(pickColumn(r, 'Sexe')),
          normalizeString(pickColumn(r, 'Groupe parlementaire', 'Groupe')),
          normalizeString(pickColumn(r, 'Région', 'Region')),
          normalizeString(pickColumn(r, 'Email')),
          normalizeString(pickColumn(r, 'Téléphone', 'Telephone')),
        ],
      );
    }
    inserted++;
  }
  return inserted;
}

async function migrateSessions(
  workbook: XLSX.WorkBook,
  opts: { dryRun?: boolean } = {},
): Promise<number> {
  const sheet =
    workbook.Sheets['Sessions parlementaires'] ?? workbook.Sheets['Sessions'];
  if (!sheet) return 0;
  const rows = XLSX.utils.sheet_to_json<UnknownRow>(sheet, { defval: null });
  let inserted = 0;
  for (const r of rows) {
    const intitule = normalizeString(pickColumn(r, 'Intitulé', 'Intitule'));
    if (!intitule) continue;
    const existing = await queryOne<{ id: string }>(
      `SELECT "id" FROM "sessionsParlementaires" WHERE "intitule" = $1 LIMIT 1`,
      [intitule],
    );
    if (existing) continue;
    if (!opts.dryRun) {
      await query(
        `INSERT INTO "sessionsParlementaires" ("intitule", "typeSession", "dateDebut", "dateFin")
         VALUES ($1, $2, $3, $4)`,
        [
          intitule,
          normalizeString(pickColumn(r, 'Type')),
          normalizeDate(pickColumn(r, 'Date début', 'Date debut')),
          normalizeDate(pickColumn(r, 'Date fin')),
        ],
      );
    }
    inserted++;
  }
  return inserted;
}

async function migrateDirections(
  workbook: XLSX.WorkBook,
  opts: { dryRun?: boolean } = {},
): Promise<number> {
  const sheet = workbook.Sheets['Directions'];
  if (!sheet) return 0;
  const rows = XLSX.utils.sheet_to_json<UnknownRow>(sheet, { defval: null });
  let inserted = 0;
  for (const r of rows) {
    const code = normalizeString(pickColumn(r, 'Code', 'CODE'));
    const fullName = normalizeString(pickColumn(r, 'Nom complet', 'Nom'));
    if (!code || !fullName) continue;
    const existing = await queryOne<{ id: string }>(
      `SELECT "id" FROM "directions" WHERE "code" = $1 LIMIT 1`,
      [code],
    );
    if (existing) continue;
    if (!opts.dryRun) {
      await query(
        `INSERT INTO "directions" ("code", "fullName", "typeEntite", "color", "ordreAffichage")
         VALUES ($1, $2, $3, $4, $5)`,
        [
          code,
          fullName,
          normalizeString(pickColumn(r, 'Type entité', 'Type entite')),
          normalizeString(pickColumn(r, 'Couleur', 'Color')),
          normalizeInt(pickColumn(r, 'Ordre', 'ordreAffichage')),
        ],
      );
    }
    inserted++;
  }
  return inserted;
}

async function migrateReferentiels(
  workbook: XLSX.WorkBook,
  opts: { dryRun?: boolean } = {},
): Promise<number> {
  const sheet = workbook.Sheets['Référentiels'] ?? workbook.Sheets['Referentiels'];
  if (!sheet) return 0;
  const rows = XLSX.utils.sheet_to_json<UnknownRow>(sheet, { defval: null });
  let inserted = 0;
  for (const r of rows) {
    const codeType = normalizeString(pickColumn(r, 'codeType', 'CODETYPE'));
    const code = normalizeString(pickColumn(r, 'code', 'CODE'));
    const label = normalizeString(pickColumn(r, 'label', 'LABEL'));
    if (!codeType || !code || !label) continue;
    const existing = await queryOne<{ id: string }>(
      `SELECT "id" FROM "referentiels" WHERE "codeType" = $1 AND "code" = $2 LIMIT 1`,
      [codeType, code],
    );
    if (existing) continue;
    if (!opts.dryRun) {
      await query(
        `INSERT INTO "referentiels"
           ("codeType", "code", "label", "description", "parentCode", "ordreAffichage", "isActive")
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, TRUE))`,
        [
          codeType,
          code,
          label,
          normalizeString(pickColumn(r, 'description')),
          normalizeString(pickColumn(r, 'parentCode')),
          normalizeInt(pickColumn(r, 'ordreAffichage')),
          (() => {
            const raw = pickColumn(r, 'isActive');
            if (raw === null || raw === undefined || raw === '') return null;
            if (typeof raw === 'boolean') return raw;
            const s = String(raw).toLowerCase().trim();
            return s === 'true' || s === '1' || s === 'oui' || s === 'yes';
          })(),
        ],
      );
    }
    inserted++;
  }
  return inserted;
}

// ---------------------------------------------------------------------------
// Mode COMPLET (toutes feuilles reconnues)
// ---------------------------------------------------------------------------

export async function importWorkbook(
  buffer: Buffer,
  opts: { dryRun?: boolean } = {},
): Promise<ImportSummary> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // --- Format historique ---
  const plan = await migratePlan(workbook, opts);
  const copil = await migrateCopil(workbook, opts);
  const cngi = await migrateCngi(workbook, opts);
  const refAss = await migrateReformeAssainissement(workbook, opts);
  const refInst = await migrateReformeInstitutionnelle(workbook, opts);
  const reunionsHist = await migrateReunions(workbook, opts);

  // --- Format export (roundtrip) ---
  const recommandationsFlat = await migrateRecommandationsFlat(workbook, opts);
  const projetsSheets = await migrateProjetsSheets(workbook, opts);
  const reunionsExport = await migrateReunionsExport(workbook, opts);
  const missions = await migrateMissions(workbook, opts);

  // --- Backup complet (feuilles supplémentaires) ---
  const interpellations = await migrateInterpellations(workbook, opts);
  const deputes = await migrateDeputes(workbook, opts);
  const sessions = await migrateSessions(workbook, opts);
  const directions = await migrateDirections(workbook, opts);
  const referentiels = await migrateReferentiels(workbook, opts);

  return {
    rencontres: plan.rencontres,
    directives: plan.directives,
    copil,
    cngi,
    reformeAssainissement: refAss,
    reformeInstitutionnelle: refInst,
    recommandationsFlat,
    projetsSheets,
    reunions: reunionsHist + reunionsExport,
    missions,
    interpellations,
    deputes,
    sessions,
    directions,
    referentiels,
  };
}
