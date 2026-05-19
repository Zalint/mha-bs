import { queryAll, queryOne } from '../db/query.js';

export interface GlobalKpis {
  totalDirectives: number;
  nbRealisees: number;
  nbEnCours: number;
  nbAttente: number;
  nbIneligibles: number;
  nbRetards: number;
  tauxExecution: number;
}

export interface StatsByDirection {
  directionId: number;
  directionCode: string;
  directionName: string;
  totalDirectives: number;
  nbRealisees: number;
  nbEnCours: number;
  nbAttente: number;
  nbIneligibles: number;
  nbRetards: number;
}

export interface StatsByType {
  typeRencontre: string;
  total: number;
  nbRealisees: number;
}

export interface EvolutionPoint {
  yearMonth: string; // YYYY-MM
  count: number;
}

export interface TopRetard {
  id: string;
  codeDirective: string;
  texteDirective: string;
  etat: string;
  echeance: string | null;
  daysLate: number;
}

export async function getGlobalKpis(): Promise<GlobalKpis> {
  const row = await queryOne<{
    totalDirectives: string;
    nbRealisees: string;
    nbEnCours: string;
    nbAttente: string;
    nbIneligibles: string;
    nbRetards: string;
    tauxExecution: string;
  }>(
    `SELECT "totalDirectives"::TEXT, "nbRealisees"::TEXT, "nbEnCours"::TEXT,
            "nbAttente"::TEXT, "nbIneligibles"::TEXT, "nbRetards"::TEXT,
            COALESCE("tauxExecution", 0)::TEXT AS "tauxExecution"
     FROM "vDashboardKpis"`,
  );
  if (!row) {
    return { totalDirectives: 0, nbRealisees: 0, nbEnCours: 0, nbAttente: 0, nbIneligibles: 0, nbRetards: 0, tauxExecution: 0 };
  }
  return {
    totalDirectives: Number(row.totalDirectives),
    nbRealisees: Number(row.nbRealisees),
    nbEnCours: Number(row.nbEnCours),
    nbAttente: Number(row.nbAttente),
    nbIneligibles: Number(row.nbIneligibles),
    nbRetards: Number(row.nbRetards),
    tauxExecution: Number(row.tauxExecution),
  };
}

export async function getKpisByTypeRencontre(typeRencontre: string): Promise<GlobalKpis> {
  const row = await queryOne<{
    totalDirectives: string;
    nbRealisees: string;
    nbEnCours: string;
    nbAttente: string;
    nbIneligibles: string;
    nbRetards: string;
  }>(
    `SELECT
       COUNT(*)::TEXT AS "totalDirectives",
       COUNT(*) FILTER (WHERE d."etat" = 'realisee')::TEXT   AS "nbRealisees",
       COUNT(*) FILTER (WHERE d."etat" = 'enCours')::TEXT    AS "nbEnCours",
       COUNT(*) FILTER (WHERE d."etat" = 'attente')::TEXT    AS "nbAttente",
       COUNT(*) FILTER (WHERE d."etat" = 'ineligible')::TEXT AS "nbIneligibles",
       COUNT(*) FILTER (
         WHERE d."etat" IN ('enCours', 'attente')
         AND d."echeance" IS NOT NULL AND d."echeance" < CURRENT_DATE
       )::TEXT AS "nbRetards"
     FROM "directives" d
     LEFT JOIN "rencontres" r ON r."id" = d."rencontreId"
     WHERE r."typeRencontre" = $1`,
    [typeRencontre],
  );
  const total = row ? Number(row.totalDirectives) : 0;
  const real = row ? Number(row.nbRealisees) : 0;
  return {
    totalDirectives: total,
    nbRealisees: real,
    nbEnCours: row ? Number(row.nbEnCours) : 0,
    nbAttente: row ? Number(row.nbAttente) : 0,
    nbIneligibles: row ? Number(row.nbIneligibles) : 0,
    nbRetards: row ? Number(row.nbRetards) : 0,
    tauxExecution: total > 0 ? Math.round((real / total) * 1000) / 10 : 0,
  };
}

export async function getStatsByDirection(): Promise<StatsByDirection[]> {
  const rows = await queryAll<{
    directionId: number;
    directionCode: string;
    directionName: string;
    totalDirectives: string;
    nbRealisees: string;
    nbEnCours: string;
    nbAttente: string;
    nbIneligibles: string;
    nbRetards: string;
  }>(
    `SELECT "directionId", "directionCode", "directionName",
            "totalDirectives"::TEXT, "nbRealisees"::TEXT, "nbEnCours"::TEXT,
            "nbAttente"::TEXT, "nbIneligibles"::TEXT, "nbRetards"::TEXT
     FROM "vDirectiveStatsByDirection"
     WHERE "totalDirectives" > 0
     ORDER BY "totalDirectives" DESC`,
  );
  return rows.map((r) => ({
    directionId: r.directionId,
    directionCode: r.directionCode,
    directionName: r.directionName,
    totalDirectives: Number(r.totalDirectives),
    nbRealisees: Number(r.nbRealisees),
    nbEnCours: Number(r.nbEnCours),
    nbAttente: Number(r.nbAttente),
    nbIneligibles: Number(r.nbIneligibles),
    nbRetards: Number(r.nbRetards),
  }));
}

export async function getEvolutionMensuelle(): Promise<EvolutionPoint[]> {
  const rows = await queryAll<{ yearMonth: string; cnt: string }>(
    `SELECT TO_CHAR(r."dateRencontre", 'YYYY-MM') AS "yearMonth",
            COUNT(*)::TEXT AS "cnt"
     FROM "directives" d
     LEFT JOIN "rencontres" r ON r."id" = d."rencontreId"
     WHERE r."dateRencontre" IS NOT NULL
     GROUP BY 1
     ORDER BY 1 DESC
     LIMIT 12`,
  );
  return rows.reverse().map((r) => ({ yearMonth: r.yearMonth, count: Number(r.cnt) }));
}

export async function getTopRetards(limit = 5): Promise<TopRetard[]> {
  const rows = await queryAll<{
    id: string;
    codeDirective: string;
    texteDirective: string;
    etat: string;
    echeance: Date;
    daysLate: string;
  }>(
    `SELECT d."id", d."codeDirective", d."texteDirective", d."etat", d."echeance",
            (CURRENT_DATE - d."echeance")::TEXT AS "daysLate"
     FROM "directives" d
     WHERE d."etat" IN ('enCours', 'attente')
       AND d."echeance" IS NOT NULL
       AND d."echeance" < CURRENT_DATE
     ORDER BY d."echeance" ASC
     LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    codeDirective: r.codeDirective,
    texteDirective: r.texteDirective,
    etat: r.etat,
    echeance: r.echeance ? r.echeance.toISOString().slice(0, 10) : null,
    daysLate: Number(r.daysLate),
  }));
}

export async function getStatsByType(): Promise<StatsByType[]> {
  const rows = await queryAll<{ typeRencontre: string; total: string; nbRealisees: string }>(
    `SELECT r."typeRencontre",
            COUNT(*)::TEXT AS "total",
            COUNT(*) FILTER (WHERE d."etat" = 'realisee')::TEXT AS "nbRealisees"
     FROM "directives" d
     LEFT JOIN "rencontres" r ON r."id" = d."rencontreId"
     WHERE r."typeRencontre" IS NOT NULL
     GROUP BY r."typeRencontre"
     ORDER BY "total" DESC`,
  );
  return rows.map((r) => ({
    typeRencontre: r.typeRencontre,
    total: Number(r.total),
    nbRealisees: Number(r.nbRealisees),
  }));
}
