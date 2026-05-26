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

async function migratePlan(
  workbook: XLSX.WorkBook,
  opts: { dryRun?: boolean } = {},
): Promise<{ rencontres: number; directives: number }> {
  const planSheet = workbook.Sheets['PLAN'];
  if (!planSheet) {
    logger.warn('Feuille "PLAN" absente, skip');
    return { rencontres: 0, directives: 0 };
  }
  const rows = XLSX.utils.sheet_to_json<UnknownRow>(planSheet, { range: 4 });

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
          const annee = normalizeInt(r['ANNEE']) ?? Number(dateRenc.slice(0, 4));
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
  missions: number;
}

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
  };
}
