/**
 * Service d'export Excel — produit le FORMAT HISTORIQUE attendu par le BS du
 * MHA, identique au fichier de référence "SUIVI ACTION MINISTERIELLE MHA.xlsx".
 *
 * 6 onglets générés (selon le périmètre) :
 *   - "PLAN"                  : directives (4 lignes de décoration + en-tête L5)
 *   - "Réf sur l'ASS"         : recommandations réforme assainissement
 *   - "Sui FeuilleR Ref Inst" : recommandations réforme institutionnelle
 *   - "Suivi Rtechnique"      : réunions techniques (1 titre + en-tête L2)
 *   - "Suivi Recom Copil"     : recommandations COPIL (blocs par projet)
 *   - "Suivi Recom CNGI"      : recommandations CNGI
 *
 * Le fichier produit est directement réimportable via /api/import — c'est le
 * format pivot pour le roundtrip export ↔ import.
 */
import ExcelJS from 'exceljs';

import { queryAll } from '../db/query.js';

export type ExportScope = 'all' | 'directives' | 'recommandations' | 'activite';

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
const SECTION_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFEF3C7' }, // jaune clair pour les bandeaux de section
};
const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

const ETAT_COLORS: Record<string, string> = {
  realisee: 'FFD1FAE5',
  enCours: 'FFFEF3C7',
  attente: 'FFDBEAFE',
  ineligible: 'FFE5E7EB',
};

const TYPE_RENCONTRE_LABEL: Record<string, string> = {
  conseilMinistres: 'CONSEIL HEBDOMADAIRE DES MINISTRES',
  conseilInterMinisteriel: 'CONSEILS/REUNIONS INTERMINISTERIELS',
  coordinationSggSg: 'COORDINATION MSGG/SG',
};

const ETAT_LABEL: Record<string, string> = {
  realisee: 'Réalisée',
  enCours: 'En cours',
  attente: 'En attente',
  ineligible: 'Inéligible',
};

function ymdFr(d: Date | string | null): string {
  if (!d) return '';
  let date: Date;
  if (typeof d === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
      const [y, m, day] = d.slice(0, 10).split('-');
      return `${day}-${m}-${y}`;
    }
    date = new Date(d);
  } else {
    date = d;
  }
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${day}-${m}-${y}`;
}

// =============================================================================
// Feuille PLAN — format historique (4 lignes de décoration + header L5)
// =============================================================================

async function addPlanSheet(wb: ExcelJS.Workbook, exporterName: string): Promise<number> {
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
            d."joursReel"
     FROM "directives" d
     LEFT JOIN "rencontres" r ON r."id" = d."rencontreId"
     ORDER BY r."dateRencontre" DESC NULLS LAST, d."codeDirective"`,
  );

  const ws = wb.addWorksheet('PLAN', {
    properties: { tabColor: { argb: 'FF0284C7' } },
  });

  // -- 4 lignes de décoration --
  ws.addRow([
    'République du Sénégal\nUn peuple – Un But – Une foi\nPRIMATURE',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    'FOCUS  - SUIVI DES DECISIONS ET INSTRUCTIONS',
  ]);
  ws.addRow(['SUIVI DES ACTIONS DU GOUVERNEMENT']);
  const isoNow = new Date().toISOString().slice(0, 16).replace('T', ' ');
  ws.addRow(['Date export', isoNow, null, null, null, null, null, null, null, null, null, null, 'Exporter par', exporterName]);
  ws.addRow([
    'INFORMATIONS',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    'DATE PREVISIONNELLE',
    null,
    'DATE REELLE',
    null,
    'EXECUTION',
    'ECART EN JOUR',
  ]);

  // -- En-tête L5 --
  ws.addRow([
    'ANNEE',
    'DATE RENCONTRE',
    'TYPE RENCONTRE',
    'CODE RENCONTRE',
    'RENCONTRE',
    'CODE DIRECTIVE',
    'TYPE DIRECTIVES',
    'DIRECTIVES',
    'RESPONSABLE',
    'MINISTERES ASSOCIES',
    'DATE RECONTRE',
    'ECHEANCE',
    'DEBUT EXECUTION',
    'FIN EXECUTION',
    'ETAT',
    'TYPE CAUSE',
    'NOMBRE JOUR DE TRAITEMENT PREVU',
    'NOMBRE JOUR DE TRAITEMENT REEL',
  ]);

  // Largeurs de colonnes
  const widths = [8, 14, 32, 18, 50, 22, 14, 80, 32, 26, 14, 14, 14, 14, 14, 22, 14, 14];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // -- Données --
  for (const r of rows) {
    ws.addRow([
      r.annee,
      ymdFr(r.dateRencontre),
      TYPE_RENCONTRE_LABEL[r.typeRencontre ?? ''] ?? r.typeRencontre ?? '',
      r.codeRencontre,
      r.intitule,
      r.codeDirective,
      'DIRECTIVES',
      r.texteDirective,
      'Ministère de l‘Hydraulique et de l’Assainissement',
      (r.ministeresAssocies ?? []).join(', '),
      ymdFr(r.dateRencontre),
      ymdFr(r.echeance),
      ymdFr(r.debutExecution),
      ymdFr(r.finExecution),
      ETAT_LABEL[r.etat] ?? r.etat,
      r.typeCause,
      r.joursPrevu,
      r.joursReel,
    ]);
  }

  // Style L1-L4 (décorations) — gras + couleur primary
  for (let i = 1; i <= 4; i++) {
    const row = ws.getRow(i);
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FF0F172A' }, size: 11 };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  }

  // Style L5 (en-tête)
  const headerRow = ws.getRow(5);
  headerRow.height = 32;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = BORDER_THIN;
  });
  ws.views = [{ state: 'frozen', ySplit: 5 }];

  // Style L6+ (data) — coloration de l'ETAT (col 15)
  for (let i = 6; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell((cell) => {
      cell.border = BORDER_THIN;
    });
    const etatCell = row.getCell(15);
    const reverseEtat = Object.entries(ETAT_LABEL).find(([, v]) => v === etatCell.value)?.[0];
    const color = reverseEtat ? ETAT_COLORS[reverseEtat] : null;
    if (color) {
      etatCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      etatCell.font = { bold: true };
    }
  }

  return rows.length;
}

// =============================================================================
// Feuille "Suivi Recom Copil" — blocs par projet (PROGEP II, PISEA, etc.)
// =============================================================================

async function addSuiviRecomCopilSheet(wb: ExcelJS.Workbook): Promise<number> {
  const projets = await queryAll<{ code: string; label: string }>(
    `SELECT "code", "label"
     FROM "referentiels"
     WHERE "codeType" = 'typeMatrice'
       AND "isActive" = TRUE
       AND (COALESCE("parentCode", '') = 'copil' OR "code" LIKE 'copil%')
     ORDER BY "ordreAffichage" ASC, "label" ASC`,
  );

  const ws = wb.addWorksheet('Suivi Recom Copil', {
    properties: { tabColor: { argb: 'FF0284C7' } },
  });

  // Largeurs (B = recommandation large)
  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 80;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 12;
  ws.getColumn(6).width = 50;

  // L1 : titre global
  ws.addRow([null, 'La Matrice de suivi des recommandation des Copils du MHA']);
  ws.getRow(1).getCell(2).font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };
  ws.mergeCells('B1:F1');

  let totalReco = 0;
  for (const projet of projets) {
    const recos = await queryAll<{
      numOrdre: number;
      texteRecommandation: string;
      etat: string;
      observations: string | null;
    }>(
      `SELECT "numOrdre", "texteRecommandation", "etat", "observations"
       FROM "recommandationsMatrice"
       WHERE "typeMatrice" = $1
       ORDER BY "numOrdre"`,
      [projet.code],
    );

    // Bandeau : <Nom projet> | Etat d'exécution | (3 cols vides) | Observations
    const sectionRow = ws.addRow([
      null,
      projet.label,
      "Etat d'exécution",
      null,
      null,
      'Observations',
    ]);
    sectionRow.eachCell((cell) => {
      cell.fill = SECTION_FILL;
      cell.font = { bold: true, size: 12 };
      cell.alignment = { vertical: 'middle' };
      cell.border = BORDER_THIN;
    });

    // Sous-en-tête : Recommandations | Attentes | en cours | exécutés
    const subHeader = ws.addRow([
      null,
      'Recommandations',
      'Attentes',
      'en cours',
      'exécutés',
      null,
    ]);
    subHeader.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = BORDER_THIN;
    });

    // Lignes de données
    for (const r of recos) {
      const row = ws.addRow([
        r.numOrdre,
        r.texteRecommandation,
        r.etat === 'attente' ? 'X' : null,
        r.etat === 'enCours' ? 'X' : null,
        r.etat === 'realisee' ? 'X' : null,
        r.observations,
      ]);
      row.alignment = { vertical: 'top', wrapText: true };
      row.eachCell((cell) => {
        cell.border = BORDER_THIN;
      });
      // Centrage X
      [3, 4, 5].forEach((col) => {
        const c = row.getCell(col);
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        if (c.value === 'X') c.font = { bold: true };
      });
    }
    totalReco += recos.length;
  }

  return totalReco;
}

// =============================================================================
// Feuille "Suivi Recom CNGI"
// =============================================================================

async function addSuiviRecomCngiSheet(wb: ExcelJS.Workbook): Promise<number> {
  const rows = await queryAll<{
    numOrdre: number;
    texteRecommandation: string;
    etat: string;
    observations: string | null;
  }>(
    `SELECT "numOrdre", "texteRecommandation", "etat", "observations"
     FROM "recommandationsMatrice"
     WHERE "typeMatrice" = 'cngi'
     ORDER BY "numOrdre"`,
  );

  const ws = wb.addWorksheet('Suivi Recom CNGI', {
    properties: { tabColor: { argb: 'FF7C2D12' } },
  });
  ws.getColumn(1).width = 80;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 50;

  // L1 titre
  const year = new Date().getFullYear();
  ws.addRow([`Suivi Recommandations CNGI ${year}`]);
  ws.getRow(1).getCell(1).font = { bold: true, size: 14 };
  ws.mergeCells('A1:E1');

  // L2 : sous-titres Etat d'exécution + Observations
  const subTitle = ws.addRow([null, "Etat d'exécution", null, null, 'Observations']);
  subTitle.eachCell((cell) => {
    cell.fill = SECTION_FILL;
    cell.font = { bold: true };
    cell.border = BORDER_THIN;
  });

  // L3 : en-tête colonnes
  const header = ws.addRow(['Les Recommandations', 'Attente', 'en cours', 'exécuté', null]);
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = BORDER_THIN;
  });

  // Données
  for (const r of rows) {
    const row = ws.addRow([
      r.texteRecommandation,
      r.etat === 'attente' ? 'X' : null,
      r.etat === 'enCours' ? 'X' : null,
      r.etat === 'realisee' ? 'X' : null,
      r.observations,
    ]);
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell((cell) => {
      cell.border = BORDER_THIN;
    });
    [2, 3, 4].forEach((col) => {
      const c = row.getCell(col);
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      if (c.value === 'X') c.font = { bold: true };
    });
  }
  ws.views = [{ state: 'frozen', ySplit: 3 }];

  return rows.length;
}

// =============================================================================
// Feuille "Réf sur l'ASS" — réforme assainissement
// =============================================================================

async function addRefSurAssSheet(wb: ExcelJS.Workbook): Promise<number> {
  const rows = await queryAll<{
    numOrdre: number;
    texteRecommandation: string;
    etat: string;
    observations: string | null;
  }>(
    `SELECT "numOrdre", "texteRecommandation", "etat", "observations"
     FROM "recommandationsMatrice"
     WHERE "typeMatrice" = 'reformeAssainissement'
     ORDER BY "numOrdre"`,
  );

  const ws = wb.addWorksheet("Réf sur l'ASS", {
    properties: { tabColor: { argb: 'FF065F46' } },
  });
  ws.getColumn(1).width = 4;
  ws.getColumn(2).width = 80;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 12;
  ws.getColumn(6).width = 50;

  // L1 : titre
  ws.addRow([null, "Matrice de suivi des recommandations sur les réformes de l'assainissement"]);
  ws.getRow(1).getCell(2).font = { bold: true, size: 14 };
  ws.mergeCells('B1:F1');

  // L2 : sous-titres
  const subTitle = ws.addRow([
    null,
    "Réformes sur l'assainissement",
    "Etat d'exécution",
    null,
    null,
    'Observations',
  ]);
  subTitle.eachCell((cell) => {
    cell.fill = SECTION_FILL;
    cell.font = { bold: true };
    cell.border = BORDER_THIN;
  });

  // L3 : en-tête colonnes
  const header = ws.addRow([null, 'Recommandations', 'Attente', 'en cours', 'exécuté', null]);
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = BORDER_THIN;
  });

  // Données
  for (const r of rows) {
    const row = ws.addRow([
      null,
      `${r.numOrdre}. ${r.texteRecommandation}`,
      r.etat === 'attente' ? 'X' : null,
      r.etat === 'enCours' ? 'X' : null,
      r.etat === 'realisee' ? 'X' : null,
      r.observations,
    ]);
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell((cell) => {
      cell.border = BORDER_THIN;
    });
    [3, 4, 5].forEach((col) => {
      const c = row.getCell(col);
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      if (c.value === 'X') c.font = { bold: true };
    });
  }
  ws.views = [{ state: 'frozen', ySplit: 3 }];

  return rows.length;
}

// =============================================================================
// Feuille "Sui FeuilleR Ref Inst" — réforme institutionnelle
// =============================================================================

async function addRefInstSheet(wb: ExcelJS.Workbook): Promise<number> {
  const rows = await queryAll<{
    numOrdre: number;
    texteRecommandation: string;
    echeanceTrimestre: string | null;
    priorite: string | null;
  }>(
    `SELECT "numOrdre", "texteRecommandation", "echeanceTrimestre", "priorite"
     FROM "recommandationsMatrice"
     WHERE "typeMatrice" = 'reformeInstitutionnelle'
     ORDER BY "numOrdre"`,
  );

  const ws = wb.addWorksheet('Sui FeuilleR Ref Inst', {
    properties: { tabColor: { argb: 'FF065F46' } },
  });
  ws.getColumn(1).width = 80;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 18;

  // L1 : titre
  ws.addRow(['Feuille de Route sur la réforme Institutionnelle du secteur Eau Assainissement']);
  ws.getRow(1).getCell(1).font = { bold: true, size: 14 };
  ws.mergeCells('A1:C1');

  // L2 : en-tête
  const header = ws.addRow(['Planification des Activités', 'Échéance/Trimestre', 'Observations']);
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = BORDER_THIN;
  });

  // Données
  for (const r of rows) {
    const row = ws.addRow([
      r.texteRecommandation,
      r.echeanceTrimestre,
      r.priorite ? r.priorite.charAt(0).toUpperCase() + r.priorite.slice(1) : null,
    ]);
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell((cell) => {
      cell.border = BORDER_THIN;
    });
  }
  ws.views = [{ state: 'frozen', ySplit: 2 }];

  return rows.length;
}

// =============================================================================
// Feuille "Suivi Rtechnique"
// =============================================================================

async function addSuiviRtechniqueSheet(wb: ExcelJS.Workbook): Promise<number> {
  const rows = await queryAll<{
    dateReunion: Date;
    theme: string;
  }>(
    `SELECT "dateReunion", "theme"
     FROM "reunionsTechniques"
     ORDER BY "dateReunion" DESC`,
  );

  const ws = wb.addWorksheet('Suivi Rtechnique', {
    properties: { tabColor: { argb: 'FFD97706' } },
  });
  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 80;

  // L1 : titre
  ws.addRow(['Suivi des réunions du MHA']);
  ws.getRow(1).getCell(1).font = { bold: true, size: 14 };
  ws.mergeCells('A1:B1');

  // L2 : en-tête (note: "Théme" tel quel pour rester compatible avec l'historique)
  const header = ws.addRow(['Date', 'Théme']);
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = BORDER_THIN;
  });

  // Données
  for (const r of rows) {
    const row = ws.addRow([ymdFr(r.dateReunion), r.theme]);
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell((cell) => {
      cell.border = BORDER_THIN;
    });
  }
  ws.views = [{ state: 'frozen', ySplit: 2 }];

  return rows.length;
}

// =============================================================================
// Builder principal
// =============================================================================

export async function buildExportWorkbook(
  scope: ExportScope,
  opts: { exporterName?: string } = {},
): Promise<{
  buffer: Buffer;
  filename: string;
  counts: { directives: number; recommandations: number; reunions: number };
}> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MHA · Bureau de Suivi';
  wb.created = new Date();
  const exporterName = opts.exporterName ?? 'MHA · Bureau de Suivi';

  let directives = 0;
  let recommandations = 0;
  let reunions = 0;

  if (scope === 'all' || scope === 'directives') {
    directives = await addPlanSheet(wb, exporterName);
  }
  if (scope === 'all' || scope === 'recommandations') {
    const nCopil = await addSuiviRecomCopilSheet(wb);
    const nCngi = await addSuiviRecomCngiSheet(wb);
    const nRefAss = await addRefSurAssSheet(wb);
    const nRefInst = await addRefInstSheet(wb);
    recommandations = nCopil + nCngi + nRefAss + nRefInst;
  }
  if (scope === 'all' || scope === 'activite') {
    reunions = await addSuiviRtechniqueSheet(wb);
  }

  const today = new Date().toISOString().slice(0, 10);
  const filename = `mha-export-${scope}-${today}.xlsx`;
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(arrayBuffer as ArrayBuffer),
    filename,
    counts: { directives, recommandations, reunions },
  };
}
