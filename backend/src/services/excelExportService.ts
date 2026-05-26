/**
 * Service d'export Excel. Génère des classeurs .xlsx stylés via exceljs avec
 * plusieurs feuilles selon le périmètre demandé.
 *
 * Périmètres :
 *   - 'directives'        : feuille PLAN
 *   - 'recommandations'   : feuilles COPIL, CNGI, Réformes
 *   - 'activite'          : feuilles Réunions techniques, Missions terrain
 *   - 'all'               : tout + feuille Sommaire en première position
 */
import ExcelJS from 'exceljs';

import { queryAll } from '../db/query.js';

export type ExportScope = 'all' | 'directives' | 'recommandations' | 'activite' | 'projets';

// =============================================================================
// Style helpers
// =============================================================================

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF0F172A' },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};
const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

const ETAT_COLORS: Record<string, string> = {
  realisee: 'FFD1FAE5',     // green-100
  enCours: 'FFFEF3C7',      // yellow-100
  attente: 'FFDBEAFE',      // blue-100
  ineligible: 'FFE5E7EB',   // gray-200
};

function styleHeaderRow(ws: ExcelJS.Worksheet): void {
  const header = ws.getRow(1);
  header.height = 28;
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = BORDER_THIN;
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function styleBodyRows(ws: ExcelJS.Worksheet, etatColumnKey?: string): void {
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell((cell) => {
      cell.border = BORDER_THIN;
    });
    if (etatColumnKey) {
      const etatCell = row.getCell(etatColumnKey);
      const color = ETAT_COLORS[String(etatCell.value ?? '')];
      if (color) {
        etatCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: color },
        };
        etatCell.font = { bold: true };
      }
    }
  });
}

const TYPE_RENCONTRE_LABEL: Record<string, string> = {
  conseilMinistres: 'CONSEIL HEBDOMADAIRE DES MINISTRES',
  conseilInterMinisteriel: 'CONSEILS/REUNIONS INTERMINISTERIELS',
  coordinationSggSg: 'COORDINATION MSGG/SG',
  copil: 'COPIL',
  cngi: 'CNGI',
  reunionTechnique: 'Réunion technique',
  commissionAn: 'Commission AN',
};

const ETAT_LABEL: Record<string, string> = {
  realisee: 'Réalisée',
  enCours: 'En cours',
  attente: 'En attente',
  ineligible: 'Inéligible',
};

function ymd(d: Date | string | null): string {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

// =============================================================================
// Builders par feuille
// =============================================================================

async function addDirectivesSheet(wb: ExcelJS.Workbook): Promise<number> {
  const rows = await queryAll<{
    annee: number;
    dateRencontre: Date | null;
    typeRencontre: string | null;
    codeRencontre: string | null;
    intitule: string | null;
    codeDirective: string;
    texteDirective: string;
    ministeresAssocies: string[];
    echeance: Date | null;
    debutExecution: Date | null;
    finExecution: Date | null;
    etat: string;
    typeCause: string | null;
    joursPrevu: number | null;
    joursReel: number | null;
    joursRetardDemarrage: number | null;
    derniereDateTraitement: Date | null;
    commentaires: string | null;
  }>(
    `SELECT r."annee",
            r."dateRencontre",
            r."typeRencontre",
            r."codeRencontre",
            r."intitule",
            d."codeDirective",
            d."texteDirective",
            d."ministeresAssocies",
            d."echeance",
            d."debutExecution",
            d."finExecution",
            d."etat",
            d."typeCause",
            d."joursPrevu",
            d."joursReel",
            d."joursRetardDemarrage",
            d."derniereDateTraitement",
            d."commentaires"
     FROM "directives" d
     LEFT JOIN "rencontres" r ON r."id" = d."rencontreId"
     ORDER BY r."dateRencontre" DESC NULLS LAST, d."codeDirective"`,
  );

  const ws = wb.addWorksheet('PLAN', {
    properties: { tabColor: { argb: 'FF0284C7' } },
  });
  ws.columns = [
    { header: 'ANNEE', key: 'annee', width: 8 },
    { header: 'DATE RENCONTRE', key: 'dateRencontre', width: 14 },
    { header: 'TYPE RENCONTRE', key: 'typeRencontre', width: 32 },
    { header: 'CODE RENCONTRE', key: 'codeRencontre', width: 18 },
    { header: 'RENCONTRE', key: 'intitule', width: 50 },
    { header: 'CODE DIRECTIVE', key: 'codeDirective', width: 22 },
    { header: 'DIRECTIVES', key: 'texteDirective', width: 80 },
    { header: 'MINISTERES ASSOCIES', key: 'ministeresAssocies', width: 26 },
    { header: 'ECHEANCE', key: 'echeance', width: 12 },
    { header: 'DEBUT EXECUTION', key: 'debutExecution', width: 14 },
    { header: 'FIN EXECUTION', key: 'finExecution', width: 14 },
    { header: 'ETAT', key: 'etat', width: 14 },
    { header: 'TYPE CAUSE', key: 'typeCause', width: 22 },
    { header: 'NOMBRE JOUR DE TRAITEMENT PREVU', key: 'joursPrevu', width: 14 },
    { header: 'NOMBRE JOUR DE TRAITEMENT REEL', key: 'joursReel', width: 14 },
    { header: 'NOMBRE JOUR RETARD DEMARRAGE', key: 'joursRetardDemarrage', width: 14 },
    { header: 'Dernière date Traitement', key: 'derniereDateTraitement', width: 14 },
    { header: 'Commentaires', key: 'commentaires', width: 40 },
  ];

  for (const r of rows) {
    ws.addRow({
      annee: r.annee,
      dateRencontre: ymd(r.dateRencontre),
      typeRencontre: TYPE_RENCONTRE_LABEL[r.typeRencontre ?? ''] ?? r.typeRencontre,
      codeRencontre: r.codeRencontre,
      intitule: r.intitule,
      codeDirective: r.codeDirective,
      texteDirective: r.texteDirective,
      ministeresAssocies: (r.ministeresAssocies ?? []).join(', '),
      echeance: ymd(r.echeance),
      debutExecution: ymd(r.debutExecution),
      finExecution: ymd(r.finExecution),
      etat: ETAT_LABEL[r.etat] ?? r.etat,
      typeCause: r.typeCause,
      joursPrevu: r.joursPrevu,
      joursReel: r.joursReel,
      joursRetardDemarrage: r.joursRetardDemarrage,
      derniereDateTraitement: ymd(r.derniereDateTraitement),
      commentaires: r.commentaires,
    });
  }

  styleHeaderRow(ws);
  styleBodyRows(ws, 'etat');
  return rows.length;
}

async function addRecommandationsSheets(wb: ExcelJS.Workbook): Promise<number> {
  const rows = await queryAll<{
    typeMatrice: string;
    matriceLabel: string | null;
    numOrdre: number;
    texteRecommandation: string;
    etat: string;
    observations: string | null;
    echeanceTrimestre: string | null;
    priorite: string | null;
  }>(
    `SELECT m."typeMatrice",
            ref."label" AS "matriceLabel",
            m."numOrdre",
            m."texteRecommandation",
            m."etat",
            m."observations",
            m."echeanceTrimestre",
            m."priorite"
     FROM "recommandationsMatrice" m
     LEFT JOIN "referentiels" ref
       ON ref."codeType" = 'typeMatrice' AND ref."code" = m."typeMatrice"
     ORDER BY m."typeMatrice", m."numOrdre"`,
  );

  // Une feuille unique "Recommandations matrices" plus simple pour l'export.
  const ws = wb.addWorksheet('Recommandations', {
    properties: { tabColor: { argb: 'FF16A34A' } },
  });
  ws.columns = [
    { header: 'Matrice', key: 'matriceLabel', width: 28 },
    { header: 'N° ordre', key: 'numOrdre', width: 10 },
    { header: 'Recommandation', key: 'texteRecommandation', width: 80 },
    { header: 'État', key: 'etat', width: 14 },
    { header: 'Échéance trim.', key: 'echeanceTrimestre', width: 12 },
    { header: 'Priorité', key: 'priorite', width: 14 },
    { header: 'Observations', key: 'observations', width: 50 },
  ];

  for (const r of rows) {
    ws.addRow({
      matriceLabel: r.matriceLabel ?? r.typeMatrice,
      numOrdre: r.numOrdre,
      texteRecommandation: r.texteRecommandation,
      etat: ETAT_LABEL[r.etat] ?? r.etat,
      echeanceTrimestre: r.echeanceTrimestre,
      priorite: r.priorite,
      observations: r.observations,
    });
  }

  styleHeaderRow(ws);
  styleBodyRows(ws, 'etat');
  return rows.length;
}

async function addReunionsSheet(wb: ExcelJS.Workbook): Promise<number> {
  const rows = await queryAll<{
    dateReunion: Date;
    heureDebut: string | null;
    dureeEstimee: string | null;
    theme: string;
    lieu: string | null;
    sousSecteur: string | null;
    copilLie: string | null;
    typeReunion: string | null;
    ordreDuJour: string | null;
    decisions: string | null;
    participants: string[] | null;
  }>(
    `SELECT "dateReunion", "heureDebut", "dureeEstimee", "theme", "lieu",
            "sousSecteur", "copilLie", "typeReunion",
            "ordreDuJour", "decisions", "participants"
     FROM "reunionsTechniques"
     ORDER BY "dateReunion" DESC`,
  );

  const ws = wb.addWorksheet('Réunions techniques', {
    properties: { tabColor: { argb: 'FFD97706' } },
  });
  ws.columns = [
    { header: 'Date', key: 'dateReunion', width: 12 },
    { header: 'Heure', key: 'heureDebut', width: 10 },
    { header: 'Durée', key: 'dureeEstimee', width: 10 },
    { header: 'Type de réunion', key: 'typeReunion', width: 14 },
    { header: 'Sous-secteur', key: 'sousSecteur', width: 18 },
    { header: 'COPIL rattaché', key: 'copilLie', width: 16 },
    { header: 'Thème', key: 'theme', width: 60 },
    { header: 'Lieu', key: 'lieu', width: 26 },
    { header: 'Ordre du jour', key: 'ordreDuJour', width: 40 },
    { header: 'Décisions', key: 'decisions', width: 40 },
    { header: 'Participants', key: 'participants', width: 30 },
  ];

  for (const r of rows) {
    ws.addRow({
      dateReunion: ymd(r.dateReunion),
      heureDebut: r.heureDebut,
      dureeEstimee: r.dureeEstimee,
      typeReunion: r.typeReunion,
      sousSecteur: r.sousSecteur,
      copilLie: r.copilLie,
      theme: r.theme,
      lieu: r.lieu,
      ordreDuJour: r.ordreDuJour,
      decisions: r.decisions,
      participants: Array.isArray(r.participants) ? r.participants.join(', ') : '',
    });
  }

  styleHeaderRow(ws);
  styleBodyRows(ws);
  return rows.length;
}

/**
 * Une feuille par COPIL projet (scope 'projets'). Lit le référentiel typeMatrice
 * filtré sur parentCode='copil' (ou code commençant par 'copil' pour la rétro-compat)
 * et génère une feuille par projet trouvé.
 */
async function addProjetsSheets(wb: ExcelJS.Workbook): Promise<number> {
  const projets = await queryAll<{ code: string; label: string }>(
    `SELECT "code", "label"
     FROM "referentiels"
     WHERE "codeType" = 'typeMatrice'
       AND "isActive" = TRUE
       AND (COALESCE("parentCode", '') = 'copil' OR "code" LIKE 'copil%')
     ORDER BY "ordreAffichage" ASC, "label" ASC`,
  );

  let totalReco = 0;
  for (const p of projets) {
    const rows = await queryAll<{
      numOrdre: number;
      texteRecommandation: string;
      etat: string;
      observations: string | null;
      echeanceTrimestre: string | null;
      priorite: string | null;
    }>(
      `SELECT "numOrdre", "texteRecommandation", "etat", "observations",
              "echeanceTrimestre", "priorite"
       FROM "recommandationsMatrice"
       WHERE "typeMatrice" = $1
       ORDER BY "numOrdre"`,
      [p.code],
    );

    // Nom de feuille Excel : max 31 caractères, sans : \ / ? * [ ]
    const safeName = p.label.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
    const ws = wb.addWorksheet(safeName, {
      properties: { tabColor: { argb: 'FF0284C7' } },
    });
    ws.columns = [
      { header: 'N° ordre', key: 'numOrdre', width: 10 },
      { header: 'Recommandation', key: 'texteRecommandation', width: 80 },
      { header: 'État', key: 'etat', width: 14 },
      { header: 'Échéance trim.', key: 'echeanceTrimestre', width: 12 },
      { header: 'Priorité', key: 'priorite', width: 14 },
      { header: 'Observations', key: 'observations', width: 50 },
    ];

    // Bandeau de titre au-dessus du tableau
    ws.spliceRows(1, 0, [p.label]);
    ws.mergeCells('A1:F1');
    const titleCell = ws.getCell('A1');
    titleCell.value = p.label;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(1).height = 28;

    for (const r of rows) {
      ws.addRow({
        numOrdre: r.numOrdre,
        texteRecommandation: r.texteRecommandation,
        etat: ETAT_LABEL[r.etat] ?? r.etat,
        echeanceTrimestre: r.echeanceTrimestre,
        priorite: r.priorite,
        observations: r.observations,
      });
    }

    // Style header (row 2 maintenant que titre est en row 1)
    const header = ws.getRow(2);
    header.height = 24;
    header.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      cell.border = BORDER_THIN;
    });
    ws.views = [{ state: 'frozen', ySplit: 2 }];

    // Body styling
    for (let i = 3; i <= ws.rowCount; i++) {
      ws.getRow(i).alignment = { vertical: 'top', wrapText: true };
      ws.getRow(i).eachCell((cell) => {
        cell.border = BORDER_THIN;
      });
      const etatCell = ws.getRow(i).getCell('etat');
      const reversedEtat = Object.entries(ETAT_LABEL).find(([, v]) => v === etatCell.value)?.[0];
      const color = reversedEtat ? ETAT_COLORS[reversedEtat] : null;
      if (color) {
        etatCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: color },
        };
        etatCell.font = { bold: true };
      }
    }

    totalReco += rows.length;
  }

  return totalReco;
}

async function addMissionsSheet(wb: ExcelJS.Workbook): Promise<number> {
  const rows = await queryAll<{
    dateMission: Date;
    localite: string;
    region: string | null;
    latitude: number | null;
    longitude: number | null;
    projetRattache: string | null;
    constats: string | null;
    recommandations: string | null;
  }>(
    `SELECT "dateMission", "localite", "region", "latitude", "longitude",
            "projetRattache", "constats", "recommandations"
     FROM "missionsTerrain"
     ORDER BY "dateMission" DESC`,
  );

  const ws = wb.addWorksheet('Missions terrain', {
    properties: { tabColor: { argb: 'FFDC2626' } },
  });
  ws.columns = [
    { header: 'Date', key: 'dateMission', width: 12 },
    { header: 'Localité', key: 'localite', width: 26 },
    { header: 'Région', key: 'region', width: 16 },
    { header: 'Latitude', key: 'latitude', width: 12 },
    { header: 'Longitude', key: 'longitude', width: 12 },
    { header: 'Projet rattaché', key: 'projetRattache', width: 22 },
    { header: 'Constats', key: 'constats', width: 50 },
    { header: 'Recommandations', key: 'recommandations', width: 50 },
  ];

  for (const r of rows) {
    ws.addRow({
      dateMission: ymd(r.dateMission),
      localite: r.localite,
      region: r.region,
      latitude: r.latitude,
      longitude: r.longitude,
      projetRattache: r.projetRattache,
      constats: r.constats,
      recommandations: r.recommandations,
    });
  }

  styleHeaderRow(ws);
  styleBodyRows(ws);
  return rows.length;
}

function addSommaireSheet(
  wb: ExcelJS.Workbook,
  counts: { directives: number; recommandations: number; reunions: number; missions: number },
): void {
  const ws = wb.addWorksheet('Sommaire', {
    properties: { tabColor: { argb: 'FF0F172A' } },
  });
  ws.columns = [
    { header: 'Catégorie', key: 'cat', width: 32 },
    { header: 'Total', key: 'total', width: 14 },
    { header: 'Feuille', key: 'sheet', width: 26 },
  ];

  ws.addRow({ cat: 'Directives présidentielles', total: counts.directives, sheet: 'PLAN' });
  ws.addRow({ cat: 'Recommandations matrices', total: counts.recommandations, sheet: 'Recommandations' });
  ws.addRow({ cat: 'Réunions techniques', total: counts.reunions, sheet: 'Réunions techniques' });
  ws.addRow({ cat: 'Missions terrain', total: counts.missions, sheet: 'Missions terrain' });

  // En-tête + titre au-dessus
  ws.insertRow(1, ['MHA · Bureau de Suivi — Export', '', '']);
  ws.insertRow(2, [`Date export : ${new Date().toISOString().slice(0, 10)}`, '', '']);
  ws.insertRow(3, []);

  // Style titre
  const title = ws.getRow(1);
  title.height = 28;
  title.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };
  ws.mergeCells('A1:C1');
  ws.getRow(2).getCell(1).font = { italic: true, color: { argb: 'FF64748B' } };
  ws.mergeCells('A2:C2');

  // Style header (row 4 maintenant)
  const header = ws.getRow(4);
  header.height = 24;
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = BORDER_THIN;
  });

  // Body
  for (let i = 5; i <= ws.rowCount; i++) {
    ws.getRow(i).eachCell((cell) => {
      cell.border = BORDER_THIN;
      cell.alignment = { vertical: 'middle' };
    });
    ws.getRow(i).getCell('total').font = { bold: true, size: 12 };
  }
}

// =============================================================================
// Builders par scope
// =============================================================================

export async function buildExportWorkbook(scope: ExportScope): Promise<{
  buffer: Buffer;
  filename: string;
  counts: { directives: number; recommandations: number; reunions: number; missions: number };
}> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MHA · Bureau de Suivi';
  wb.created = new Date();

  // Pour scope='all' : on pré-compte avant de générer les feuilles afin de pouvoir
  // ajouter le Sommaire en première position.
  let counts = { directives: 0, recommandations: 0, reunions: 0, missions: 0 };
  if (scope === 'all') {
    counts = await preCounts();
    addSommaireSheet(wb, counts);
  }

  if (scope === 'all' || scope === 'directives') {
    const n = await addDirectivesSheet(wb);
    if (scope !== 'all') counts.directives = n;
  }
  if (scope === 'all' || scope === 'recommandations') {
    const n = await addRecommandationsSheets(wb);
    if (scope !== 'all') counts.recommandations = n;
  }
  if (scope === 'all' || scope === 'activite') {
    const n1 = await addReunionsSheet(wb);
    const n2 = await addMissionsSheet(wb);
    if (scope !== 'all') {
      counts.reunions = n1;
      counts.missions = n2;
    }
  }
  if (scope === 'projets') {
    const n = await addProjetsSheets(wb);
    counts.recommandations = n;
  }

  const today = new Date().toISOString().slice(0, 10);
  const filename = `mha-export-${scope}-${today}.xlsx`;
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(arrayBuffer as ArrayBuffer), filename, counts };
}

async function preCounts(): Promise<{
  directives: number;
  recommandations: number;
  reunions: number;
  missions: number;
}> {
  const [d, r, re, m] = await Promise.all([
    queryAll<{ n: string }>(`SELECT COUNT(*)::TEXT AS "n" FROM "directives"`),
    queryAll<{ n: string }>(`SELECT COUNT(*)::TEXT AS "n" FROM "recommandationsMatrice"`),
    queryAll<{ n: string }>(`SELECT COUNT(*)::TEXT AS "n" FROM "reunionsTechniques"`),
    queryAll<{ n: string }>(`SELECT COUNT(*)::TEXT AS "n" FROM "missionsTerrain"`),
  ]);
  return {
    directives: Number(d[0]?.n ?? 0),
    recommandations: Number(r[0]?.n ?? 0),
    reunions: Number(re[0]?.n ?? 0),
    missions: Number(m[0]?.n ?? 0),
  };
}
