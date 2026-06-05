/**
 * Explorer — moteur de requête générique pour le "mode Power BI".
 *
 * Permet au frontend de construire des agrégations ad-hoc (group by N dimensions
 * + 1 mesure + filtres) SANS écrire de SQL côté client. La sécurité repose sur
 * un REGISTRE (whitelist) : le client n'envoie que des CLÉS connues — jamais de
 * noms de colonnes ou de SQL brut. Toute clé inconnue est rejetée.
 *
 * Trois opérations :
 *   - getSchema()      → décrit les sources, dimensions, mesures, filtres
 *   - runQuery(spec)   → agrégation (pour les graphes + pivot)
 *   - runRows(spec)    → lignes brutes (pour le drill-down)
 */

import { queryAll } from '../db/query.js';

// ---------------------------------------------------------------------------
// Types du registre
// ---------------------------------------------------------------------------

interface DimensionDef {
  key: string;
  label: string;
  /** Expression SQL scalaire (utilisée en SELECT et GROUP BY). */
  sql: string;
}

interface MeasureDef {
  key: string;
  label: string;
  /** Expression SQL d'agrégat (ex: COUNT(*), AVG(...)). */
  sql: string;
  /** Format d'affichage côté front. */
  format: 'int' | 'decimal1' | 'percent';
}

interface FilterDef {
  key: string;
  label: string;
  /** Expression SQL scalaire à comparer (ex: d."etat"). */
  sql: string;
  type: 'enum' | 'number' | 'text';
  /** Valeurs possibles (enum) — exposées au front pour les slicers. */
  values?: { value: string; label: string }[];
}

interface SourceDef {
  key: string;
  label: string;
  /** Clause FROM + JOINs. */
  from: string;
  /** Colonnes affichées dans le drill-down (rows brutes). */
  rowColumns: { sql: string; label: string }[];
  dimensions: Record<string, DimensionDef>;
  measures: Record<string, MeasureDef>;
  filters: Record<string, FilterDef>;
}

// ---------------------------------------------------------------------------
// Référentiels de valeurs (labels propres)
// ---------------------------------------------------------------------------

const ETAT_VALUES = [
  { value: 'attente', label: 'En attente' },
  { value: 'enCours', label: 'En cours' },
  { value: 'realisee', label: 'Réalisée' },
  { value: 'ineligible', label: 'Inéligible' },
];

const TYPE_RENCONTRE_VALUES = [
  { value: 'conseilMinistres', label: 'Conseil des Ministres' },
  { value: 'conseilInterMinisteriel', label: 'Conseil Interministériel' },
  { value: 'coordinationSggSg', label: 'Coordination SGG/SG' },
];

const SOUS_SECTEUR_VALUES = [
  { value: 'eau', label: 'Eau' },
  { value: 'gire', label: 'GIRE' },
  { value: 'assainissement', label: 'Assainissement' },
  { value: 'inondations', label: 'Inondations' },
  { value: 'transversal', label: 'Transversal' },
  { value: 'reformeInstitutionnelle', label: 'Réforme institutionnelle' },
];

const PRIORITE_VALUES = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'prioritaire', label: 'Prioritaire' },
  { value: 'obligatoire', label: 'Obligatoire' },
  { value: 'standard', label: 'Standard' },
];

// ---------------------------------------------------------------------------
// REGISTRE des sources
// ---------------------------------------------------------------------------

const SOURCES: Record<string, SourceDef> = {
  directives: {
    key: 'directives',
    label: 'Directives présidentielles',
    from: `"directives" d JOIN "rencontres" r ON r."id" = d."rencontreId"`,
    rowColumns: [
      { sql: `d."codeDirective"`, label: 'Code' },
      { sql: `LEFT(d."texteDirective", 90)`, label: 'Directive' },
      { sql: `d."etat"`, label: 'État' },
      { sql: `r."annee"::TEXT`, label: 'Année' },
      { sql: `r."typeRencontre"`, label: 'Type rencontre' },
      { sql: `d."echeance"::TEXT`, label: 'Échéance' },
    ],
    dimensions: {
      annee: { key: 'annee', label: 'Année (exercice)', sql: `r."annee"::TEXT` },
      etat: { key: 'etat', label: 'État', sql: `d."etat"` },
      typeRencontre: { key: 'typeRencontre', label: 'Type de rencontre', sql: `r."typeRencontre"` },
      mois: { key: 'mois', label: 'Mois (rencontre)', sql: `TO_CHAR(r."dateRencontre", 'YYYY-MM')` },
      anneeEcheance: {
        key: 'anneeEcheance',
        label: 'Année d\'échéance',
        sql: `COALESCE(EXTRACT(YEAR FROM d."echeance")::TEXT, '(aucune)')`,
      },
      typeCause: { key: 'typeCause', label: 'Type de cause', sql: `COALESCE(d."typeCause", '(non renseigné)')` },
    },
    measures: {
      count: { key: 'count', label: 'Nombre', sql: `COUNT(*)`, format: 'int' },
      tauxRealisation: {
        key: 'tauxRealisation',
        label: '% réalisées',
        sql: `ROUND(100.0 * COUNT(*) FILTER (WHERE d."etat" = 'realisee') / NULLIF(COUNT(*), 0), 1)`,
        format: 'percent',
      },
      joursPrevuMoy: {
        key: 'joursPrevuMoy',
        label: 'Jours prévus (moy.)',
        sql: `ROUND(AVG(d."joursPrevu"), 1)`,
        format: 'decimal1',
      },
      joursReelMoy: {
        key: 'joursReelMoy',
        label: 'Jours réels (moy.)',
        sql: `ROUND(AVG(d."joursReel"), 1)`,
        format: 'decimal1',
      },
    },
    filters: {
      annee: { key: 'annee', label: 'Année', sql: `r."annee"`, type: 'number' },
      etat: { key: 'etat', label: 'État', sql: `d."etat"`, type: 'enum', values: ETAT_VALUES },
      typeRencontre: {
        key: 'typeRencontre',
        label: 'Type de rencontre',
        sql: `r."typeRencontre"`,
        type: 'enum',
        values: TYPE_RENCONTRE_VALUES,
      },
    },
  },

  recommandations: {
    key: 'recommandations',
    label: 'Recommandations matrice',
    from: `"recommandationsMatrice" rm
           LEFT JOIN "referentiels" ref
             ON ref."codeType" = 'typeMatrice' AND ref."code" = rm."typeMatrice"`,
    rowColumns: [
      { sql: `COALESCE(ref."label", rm."typeMatrice")`, label: 'Matrice' },
      { sql: `LEFT(rm."texteRecommandation", 90)`, label: 'Recommandation' },
      { sql: `rm."etat"`, label: 'État' },
      { sql: `COALESCE(rm."priorite", '—')`, label: 'Priorité' },
      { sql: `COALESCE(rm."echeanceTrimestre", '—')`, label: 'Échéance' },
    ],
    dimensions: {
      categorie: {
        key: 'categorie',
        label: 'Catégorie',
        sql: `COALESCE(ref."parentCode", rm."typeMatrice", 'autres')`,
      },
      matrice: { key: 'matrice', label: 'Matrice (projet)', sql: `COALESCE(ref."label", rm."typeMatrice")` },
      etat: { key: 'etat', label: 'État', sql: `rm."etat"` },
      priorite: { key: 'priorite', label: 'Priorité', sql: `COALESCE(rm."priorite", '(non renseignée)')` },
      echeanceTrimestre: {
        key: 'echeanceTrimestre',
        label: 'Échéance (trimestre)',
        sql: `COALESCE(rm."echeanceTrimestre", '(aucune)')`,
      },
    },
    measures: {
      count: { key: 'count', label: 'Nombre', sql: `COUNT(*)`, format: 'int' },
      tauxRealisation: {
        key: 'tauxRealisation',
        label: '% réalisées',
        sql: `ROUND(100.0 * COUNT(*) FILTER (WHERE rm."etat" = 'realisee') / NULLIF(COUNT(*), 0), 1)`,
        format: 'percent',
      },
    },
    filters: {
      etat: { key: 'etat', label: 'État', sql: `rm."etat"`, type: 'enum', values: ETAT_VALUES },
      priorite: { key: 'priorite', label: 'Priorité', sql: `rm."priorite"`, type: 'enum', values: PRIORITE_VALUES },
    },
  },

  reunions: {
    key: 'reunions',
    label: 'Réunions techniques',
    from: `"reunionsTechniques" rt`,
    rowColumns: [
      { sql: `rt."dateReunion"::TEXT`, label: 'Date' },
      { sql: `LEFT(rt."theme", 90)`, label: 'Thème' },
      { sql: `COALESCE(rt."sousSecteur", '—')`, label: 'Sous-secteur' },
      { sql: `COALESCE(rt."copilLie", '—')`, label: 'COPIL' },
    ],
    dimensions: {
      annee: { key: 'annee', label: 'Année', sql: `EXTRACT(YEAR FROM rt."dateReunion")::TEXT` },
      mois: { key: 'mois', label: 'Mois', sql: `TO_CHAR(rt."dateReunion", 'YYYY-MM')` },
      trimestre: {
        key: 'trimestre',
        label: 'Trimestre',
        sql: `EXTRACT(YEAR FROM rt."dateReunion")::TEXT || '-T' || EXTRACT(QUARTER FROM rt."dateReunion")::TEXT`,
      },
      sousSecteur: { key: 'sousSecteur', label: 'Sous-secteur', sql: `COALESCE(rt."sousSecteur", '(aucun)')` },
      copil: { key: 'copil', label: 'COPIL', sql: `COALESCE(rt."copilLie", '(aucun)')` },
    },
    measures: {
      count: { key: 'count', label: 'Nombre', sql: `COUNT(*)`, format: 'int' },
    },
    filters: {
      sousSecteur: {
        key: 'sousSecteur',
        label: 'Sous-secteur',
        sql: `rt."sousSecteur"`,
        type: 'enum',
        values: SOUS_SECTEUR_VALUES,
      },
    },
  },

  missions: {
    key: 'missions',
    label: 'Missions terrain',
    from: `"missionsTerrain" mt`,
    rowColumns: [
      { sql: `mt."dateMission"::TEXT`, label: 'Date' },
      { sql: `mt."localite"`, label: 'Localité' },
      { sql: `COALESCE(mt."region", '—')`, label: 'Région' },
      { sql: `COALESCE(mt."projetRattache", '—')`, label: 'Projet' },
    ],
    dimensions: {
      annee: { key: 'annee', label: 'Année', sql: `EXTRACT(YEAR FROM mt."dateMission")::TEXT` },
      mois: { key: 'mois', label: 'Mois', sql: `TO_CHAR(mt."dateMission", 'YYYY-MM')` },
      region: { key: 'region', label: 'Région', sql: `COALESCE(mt."region", '(non renseignée)')` },
      projet: { key: 'projet', label: 'Projet rattaché', sql: `COALESCE(mt."projetRattache", '(aucun)')` },
    },
    measures: {
      count: { key: 'count', label: 'Nombre', sql: `COUNT(*)`, format: 'int' },
    },
    filters: {
      region: { key: 'region', label: 'Région', sql: `mt."region"`, type: 'text' },
    },
  },
};

// ---------------------------------------------------------------------------
// Schéma exposé au front (sans les expressions SQL internes)
// ---------------------------------------------------------------------------

export function getExplorerSchema() {
  return Object.values(SOURCES).map((s) => ({
    key: s.key,
    label: s.label,
    dimensions: Object.values(s.dimensions).map((d) => ({ key: d.key, label: d.label })),
    measures: Object.values(s.measures).map((m) => ({
      key: m.key,
      label: m.label,
      format: m.format,
    })),
    filters: Object.values(s.filters).map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      values: f.values ?? null,
    })),
  }));
}

// ---------------------------------------------------------------------------
// Construction WHERE à partir de filtres whitelistés
// ---------------------------------------------------------------------------

export interface QueryFilter {
  key: string;
  /** Valeurs sélectionnées (OR entre elles). */
  values: (string | number)[];
}

function buildWhere(
  source: SourceDef,
  filters: QueryFilter[],
  params: unknown[],
): string {
  const clauses: string[] = [];
  for (const f of filters) {
    const def = source.filters[f.key];
    if (!def || f.values.length === 0) continue;
    // IN (...) paramétré
    const placeholders = f.values.map((v) => {
      params.push(def.type === 'number' ? Number(v) : v);
      return `$${params.length}`;
    });
    clauses.push(`${def.sql} IN (${placeholders.join(', ')})`);
  }
  return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
}

// ---------------------------------------------------------------------------
// runQuery : agrégation group-by
// ---------------------------------------------------------------------------

export interface QuerySpec {
  source: string;
  dimensions: string[]; // clés (0 à 2)
  measure: string; // clé
  filters: QueryFilter[];
  limit?: number;
}

export interface QueryResultRow {
  /** Valeurs des dimensions, dans l'ordre de spec.dimensions. */
  dims: string[];
  /** Valeur de la mesure (number). */
  value: number;
}

export async function runQuery(spec: QuerySpec): Promise<{
  rows: QueryResultRow[];
  dimensionLabels: string[];
  measureLabel: string;
  measureFormat: string;
}> {
  const source = SOURCES[spec.source];
  if (!source) throw new Error(`Source inconnue: ${spec.source}`);

  const measureDef = source.measures[spec.measure];
  if (!measureDef) throw new Error(`Mesure inconnue: ${spec.measure}`);

  const dimDefs = spec.dimensions.slice(0, 2).map((k) => {
    const d = source.dimensions[k];
    if (!d) throw new Error(`Dimension inconnue: ${k}`);
    return d;
  });

  const params: unknown[] = [];
  const where = buildWhere(source, spec.filters, params);

  const dimSelect = dimDefs.map((d, i) => `${d.sql} AS "d${i}"`).join(', ');
  const dimGroup = dimDefs.map((d) => d.sql).join(', ');
  const selectParts = [dimSelect, `${measureDef.sql} AS "value"`].filter(Boolean).join(', ');

  const limit = Math.min(spec.limit ?? 200, 500);

  const sql = `
    SELECT ${selectParts}
    FROM ${source.from}
    ${where}
    ${dimGroup ? `GROUP BY ${dimGroup}` : ''}
    ${dimGroup ? `ORDER BY ${dimGroup}` : 'ORDER BY "value" DESC'}
    LIMIT ${limit}
  `;

  const raw = await queryAll<Record<string, unknown>>(sql, params);
  const rows: QueryResultRow[] = raw.map((r) => {
    const dims = dimDefs.map((_, i) => {
      const v = r[`d${i}`];
      return v === null || v === undefined ? '(vide)' : String(v);
    });
    const value = r['value'] === null ? 0 : Number(r['value']);
    return { dims, value };
  });

  return {
    rows,
    dimensionLabels: dimDefs.map((d) => d.label),
    measureLabel: measureDef.label,
    measureFormat: measureDef.format,
  };
}

// ---------------------------------------------------------------------------
// runRows : lignes brutes (drill-down)
// ---------------------------------------------------------------------------

export async function runRows(
  sourceKey: string,
  filters: QueryFilter[],
  limit = 100,
): Promise<{ columns: string[]; rows: string[][] }> {
  const source = SOURCES[sourceKey];
  if (!source) throw new Error(`Source inconnue: ${sourceKey}`);

  const params: unknown[] = [];
  const where = buildWhere(source, filters, params);
  const cols = source.rowColumns.map((c, i) => `${c.sql} AS "c${i}"`).join(', ');
  const sql = `SELECT ${cols} FROM ${source.from} ${where} LIMIT ${Math.min(limit, 300)}`;
  const raw = await queryAll<Record<string, unknown>>(sql, params);
  return {
    columns: source.rowColumns.map((c) => c.label),
    rows: raw.map((r) =>
      source.rowColumns.map((_, i) => {
        const v = r[`c${i}`];
        return v === null || v === undefined ? '' : String(v);
      }),
    ),
  };
}
