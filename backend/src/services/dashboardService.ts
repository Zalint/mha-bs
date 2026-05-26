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

export async function getKpisByTypeRencontre(
  typeRencontre: string,
  annee?: number,
): Promise<GlobalKpis> {
  const params: (string | number)[] = [typeRencontre];
  let anneeClause = '';
  if (annee !== undefined) {
    params.push(annee);
    anneeClause = `AND r."annee" = $${params.length}`;
  }

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
     WHERE r."typeRencontre" = $1 ${anneeClause}`,
    params,
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

// =============================================================================
// Vue SG : agrégation par catégorie avec filtre année
// =============================================================================

export interface CopilSummary {
  copilSuivis: number;        // nombre de COPIL distincts (typeMatrice LIKE 'copil%')
  recommandations: number;    // total recommandations COPIL
  nbRealisees: number;
  nbEnCours: number;
  nbAttente: number;
}

export interface ReunionsTechniquesSummary {
  reunionsTenues: number;
  parMois: { yearMonth: string; count: number }[]; // 6 derniers mois
  parSousSecteur: { key: string; label: string; count: number }[];
  parCopil: { copil: string; count: number }[];
}

const SOUS_SECTEUR_LABELS: Record<string, string> = {
  eau: 'Eau (accès)',
  gire: 'GIRE (ressources en eau)',
  assainissement: 'Assainissement (eaux usées)',
  inondations: 'Eaux pluviales / Inondations',
  transversal: 'Projets transversaux',
  reformeInstitutionnelle: 'Réforme institutionnelle',
};

export interface MissionsTerrainSummary {
  missionsEffectuees: number;
  regionsCouvertes: number;
  totalRegions: number;       // référence pour la barre de progression (14 au Sénégal)
  prochaineDate: string | null;
  prochaineLocalite: string | null;
}

export interface CategorieRecommandationSummary {
  code: string;          // code de la catégorie (copil/reformes/cngi/autres/...)
  label: string;         // label de la catégorie
  nbMatrices: number;    // nombre de matrices dans cette catégorie
  recommandations: number;
  nbRealisees: number;
  nbEnCours: number;
  nbAttente: number;
}

export interface SgSummary {
  annee: number | null;
  availableYears: number[];
  directives: {
    conseilMinistres: GlobalKpis;
    conseilInterMinisteriel: GlobalKpis;
    coordinationSggSg: GlobalKpis;
  };
  copil: CopilSummary;
  // Stats par catégorie de matrice (driven by matriceCategorie + parentCode)
  recommandationsParCategorie: CategorieRecommandationSummary[];
  reunionsTechniques: ReunionsTechniquesSummary;
  missionsTerrain: MissionsTerrainSummary;
}

/**
 * Récupère les COPIL stats. Pas de filtre année car la table recommandationsMatrice
 * ne porte pas de date métier — le stock total reflète l'état courant du portefeuille.
 */
export async function getCopilSummary(): Promise<CopilSummary> {
  const row = await queryOne<{
    copilSuivis: string;
    recommandations: string;
    nbRealisees: string;
    nbEnCours: string;
    nbAttente: string;
  }>(
    `SELECT
       COUNT(DISTINCT "typeMatrice")::TEXT                            AS "copilSuivis",
       COUNT(*)::TEXT                                                  AS "recommandations",
       COUNT(*) FILTER (WHERE "etat" = 'realisee')::TEXT               AS "nbRealisees",
       COUNT(*) FILTER (WHERE "etat" = 'enCours')::TEXT                AS "nbEnCours",
       COUNT(*) FILTER (WHERE "etat" = 'attente')::TEXT                AS "nbAttente"
     FROM "recommandationsMatrice"
     WHERE "typeMatrice" LIKE 'copil%'`,
  );
  return {
    copilSuivis: row ? Number(row.copilSuivis) : 0,
    recommandations: row ? Number(row.recommandations) : 0,
    nbRealisees: row ? Number(row.nbRealisees) : 0,
    nbEnCours: row ? Number(row.nbEnCours) : 0,
    nbAttente: row ? Number(row.nbAttente) : 0,
  };
}

/**
 * Stats par catégorie de matrice (driven by parentCode du référentiel typeMatrice).
 * Renvoie une entrée par catégorie active du référentiel matriceCategorie, y compris
 * celles qui n'ont aucune matrice rattachée (pour exposer la catégorie dans l'UI).
 */
export async function getRecommandationsByCategorie(): Promise<CategorieRecommandationSummary[]> {
  const rows = await queryAll<{
    code: string;
    label: string;
    nbMatrices: string;
    recommandations: string;
    nbRealisees: string;
    nbEnCours: string;
    nbAttente: string;
  }>(
    `SELECT
       cat."code",
       cat."label",
       COUNT(DISTINCT mr."code") FILTER (WHERE mr."code" IS NOT NULL)::TEXT AS "nbMatrices",
       COUNT(rm.*)::TEXT                                                   AS "recommandations",
       COUNT(rm.*) FILTER (WHERE rm."etat" = 'realisee')::TEXT              AS "nbRealisees",
       COUNT(rm.*) FILTER (WHERE rm."etat" = 'enCours')::TEXT               AS "nbEnCours",
       COUNT(rm.*) FILTER (WHERE rm."etat" = 'attente')::TEXT               AS "nbAttente"
     FROM "referentiels" cat
     LEFT JOIN "referentiels" mr
       ON mr."codeType" = 'typeMatrice'
       AND COALESCE(mr."parentCode", 'autres') = cat."code"
     LEFT JOIN "recommandationsMatrice" rm
       ON rm."typeMatrice" = mr."code"
     WHERE cat."codeType" = 'matriceCategorie' AND cat."isActive" = TRUE
     GROUP BY cat."code", cat."label", cat."ordreAffichage"
     ORDER BY cat."ordreAffichage" ASC, cat."label" ASC`,
  );
  return rows.map((r) => ({
    code: r.code,
    label: r.label,
    nbMatrices: Number(r.nbMatrices),
    recommandations: Number(r.recommandations),
    nbRealisees: Number(r.nbRealisees),
    nbEnCours: Number(r.nbEnCours),
    nbAttente: Number(r.nbAttente),
  }));
}

export async function getReunionsTechniquesSummary(
  annee?: number,
): Promise<ReunionsTechniquesSummary> {
  const params: number[] = [];
  let where = '';
  if (annee !== undefined) {
    params.push(annee);
    where = `WHERE EXTRACT(YEAR FROM "dateReunion") = $1`;
  }
  const totalRow = await queryOne<{ n: string }>(
    `SELECT COUNT(*)::TEXT AS "n" FROM "reunionsTechniques" ${where}`,
    params,
  );

  // 6 derniers mois (glissants depuis aujourd'hui) — toujours non filtré par année
  // car on veut une trend lisible même si l'année courante a peu de données.
  const parMoisRows = await queryAll<{ yearMonth: string; cnt: string }>(
    `SELECT TO_CHAR("dateReunion", 'YYYY-MM') AS "yearMonth",
            COUNT(*)::TEXT AS "cnt"
     FROM "reunionsTechniques"
     WHERE "dateReunion" >= (CURRENT_DATE - INTERVAL '6 months')
     GROUP BY 1
     ORDER BY 1 ASC`,
  );

  // Répartitions par sous-secteur et par COPIL — filtrées par l'année active
  const parSousSecteurRows = await queryAll<{ sousSecteur: string | null; cnt: string }>(
    `SELECT "sousSecteur", COUNT(*)::TEXT AS "cnt"
     FROM "reunionsTechniques"
     ${where}
     GROUP BY "sousSecteur"
     ORDER BY COUNT(*) DESC`,
    params,
  );
  const parCopilRows = await queryAll<{ copilLie: string | null; cnt: string }>(
    `SELECT "copilLie", COUNT(*)::TEXT AS "cnt"
     FROM "reunionsTechniques"
     ${where}
     ${where ? 'AND' : 'WHERE'} "copilLie" IS NOT NULL AND "copilLie" <> ''
     GROUP BY "copilLie"
     ORDER BY COUNT(*) DESC`,
    params,
  );

  return {
    reunionsTenues: totalRow ? Number(totalRow.n) : 0,
    parMois: parMoisRows.map((r) => ({ yearMonth: r.yearMonth, count: Number(r.cnt) })),
    parSousSecteur: parSousSecteurRows
      .filter((r) => r.sousSecteur !== null)
      .map((r) => ({
        key: r.sousSecteur as string,
        label: SOUS_SECTEUR_LABELS[r.sousSecteur as string] ?? (r.sousSecteur as string),
        count: Number(r.cnt),
      })),
    parCopil: parCopilRows
      .filter((r) => r.copilLie !== null)
      .map((r) => ({ copil: r.copilLie as string, count: Number(r.cnt) })),
  };
}

export async function getMissionsTerrainSummary(
  annee?: number,
): Promise<MissionsTerrainSummary> {
  const params: number[] = [];
  let where = '';
  if (annee !== undefined) {
    params.push(annee);
    where = `WHERE EXTRACT(YEAR FROM "dateMission") = $1`;
  }
  const row = await queryOne<{
    missions: string;
    regions: string;
  }>(
    `SELECT COUNT(*)::TEXT                       AS "missions",
            COUNT(DISTINCT "region")::TEXT       AS "regions"
     FROM "missionsTerrain" ${where}`,
    params,
  );
  const prochain = await queryOne<{ dateMission: Date; localite: string }>(
    `SELECT "dateMission", "localite"
     FROM "missionsTerrain"
     WHERE "dateMission" >= CURRENT_DATE
     ORDER BY "dateMission" ASC
     LIMIT 1`,
  );
  return {
    missionsEffectuees: row ? Number(row.missions) : 0,
    regionsCouvertes: row ? Number(row.regions) : 0,
    totalRegions: 14, // Sénégal : 14 régions administratives
    prochaineDate: prochain?.dateMission ? prochain.dateMission.toISOString().slice(0, 10) : null,
    prochaineLocalite: prochain?.localite ?? null,
  };
}

/**
 * Liste des années qui ont des données quelque part (rencontres, réunions ou missions).
 * Toujours inclut l'année courante. Triées DESC.
 */
export async function getAvailableYears(): Promise<number[]> {
  const rows = await queryAll<{ annee: string }>(
    `SELECT DISTINCT "annee"::TEXT AS "annee" FROM (
       SELECT "annee" FROM "rencontres" WHERE "annee" IS NOT NULL
       UNION
       SELECT EXTRACT(YEAR FROM "dateReunion")::INT FROM "reunionsTechniques"
       UNION
       SELECT EXTRACT(YEAR FROM "dateMission")::INT FROM "missionsTerrain"
     ) y
     ORDER BY "annee" DESC`,
  );
  const years = new Set<number>(rows.map((r) => Number(r.annee)));
  years.add(new Date().getUTCFullYear());
  return Array.from(years).sort((a, b) => b - a);
}

export async function getSgSummary(annee?: number): Promise<SgSummary> {
  const [
    availableYears,
    conseilMinistres,
    conseilInterMinisteriel,
    coordinationSggSg,
    copil,
    recommandationsParCategorie,
    reunionsTechniques,
    missionsTerrain,
  ] = await Promise.all([
    getAvailableYears(),
    getKpisByTypeRencontre('conseilMinistres', annee),
    getKpisByTypeRencontre('conseilInterMinisteriel', annee),
    getKpisByTypeRencontre('coordinationSggSg', annee),
    getCopilSummary(),
    getRecommandationsByCategorie(),
    getReunionsTechniquesSummary(annee),
    getMissionsTerrainSummary(annee),
  ]);
  return {
    annee: annee ?? null,
    availableYears,
    directives: { conseilMinistres, conseilInterMinisteriel, coordinationSggSg },
    copil,
    recommandationsParCategorie,
    reunionsTechniques,
    missionsTerrain,
  };
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
