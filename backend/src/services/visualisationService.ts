/**
 * Agrégations pour le module Visualisations.
 *
 * Chaque fonction retourne un dataset prêt à brancher dans une chart
 * Recharts côté frontend. Les filtres globaux (annee, anneeMode,
 * typeRencontre) sont appliqués de façon cohérente avec les autres modules
 * (cf. directiveAnneeFilter.ts).
 *
 * Toutes les requêtes joignent directives à rencontres pour pouvoir
 * filtrer par typeRencontre et appliquer la sémantique anneeMode.
 */

import type { AnneeMode } from '@mha-bs/shared';

import { queryAll } from '../db/query.js';
import { directiveAnneeClause } from '../lib/directiveAnneeFilter.js';

export interface VisuFilters {
  annee?: number;
  anneeMode: AnneeMode;
  typeRencontre?: string;
  /** 2e layer : si true, restreint aussi aux créées dans `annee`. */
  creeEnAnneeOnly?: boolean;
}

/**
 * Helper interne : construit la clause WHERE commune (annee filter + type).
 * Retourne { whereSql, params } pour être interpolé dans chaque query.
 */
function buildDirectiveWhere(filters: VisuFilters): {
  whereSql: string;
  params: (string | number)[];
} {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.typeRencontre) {
    params.push(filters.typeRencontre);
    conditions.push(`r."typeRencontre" = $${params.length}`);
  }
  if (filters.annee !== undefined) {
    params.push(filters.annee);
    conditions.push(
      directiveAnneeClause(filters.anneeMode, params.length, filters.creeEnAnneeOnly ?? false),
    );
  }

  return {
    whereSql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

// =============================================================================
// CHART 1 : Directives par état × année (stacked bar)
// =============================================================================
export interface DirectivesEtatParAnnee {
  annee: number;
  attente: number;
  enCours: number;
  realisee: number;
  ineligible: number;
}
export async function getDirectivesEtatParAnnee(
  filters: VisuFilters,
): Promise<DirectivesEtatParAnnee[]> {
  // On ignore le filtre annee ici pour montrer l'évolution sur toutes les
  // années disponibles, mais on respecte typeRencontre.
  const params: (string | number)[] = [];
  let whereType = '';
  if (filters.typeRencontre) {
    params.push(filters.typeRencontre);
    whereType = `WHERE r."typeRencontre" = $${params.length}`;
  }
  const rows = await queryAll<{
    annee: string;
    etat: string;
    n: string;
  }>(
    `SELECT r."annee"::TEXT AS "annee", d."etat", COUNT(*)::TEXT AS "n"
     FROM "directives" d
     JOIN "rencontres" r ON r."id" = d."rencontreId"
     ${whereType}
     GROUP BY r."annee", d."etat"
     ORDER BY r."annee" ASC`,
    params,
  );
  // Pivot : 1 ligne par année, colonnes par état
  const map = new Map<number, DirectivesEtatParAnnee>();
  for (const row of rows) {
    const annee = Number(row.annee);
    if (!map.has(annee)) {
      map.set(annee, {
        annee,
        attente: 0,
        enCours: 0,
        realisee: 0,
        ineligible: 0,
      });
    }
    const r = map.get(annee)!;
    const n = Number(row.n);
    if (row.etat === 'attente') r.attente = n;
    else if (row.etat === 'enCours') r.enCours = n;
    else if (row.etat === 'realisee') r.realisee = n;
    else if (row.etat === 'ineligible') r.ineligible = n;
  }
  return Array.from(map.values()).sort((a, b) => a.annee - b.annee);
}

// =============================================================================
// CHART 2 : Évolution mensuelle des nouvelles directives (line)
// =============================================================================
export interface DirectivesNouvellesParMois {
  mois: string; // 'YYYY-MM'
  nb: number;
}
export async function getDirectivesNouvellesParMois(
  filters: VisuFilters,
): Promise<DirectivesNouvellesParMois[]> {
  const { whereSql, params } = buildDirectiveWhere(filters);
  const rows = await queryAll<{ mois: string; n: string }>(
    `SELECT TO_CHAR(r."dateRencontre", 'YYYY-MM') AS "mois",
            COUNT(*)::TEXT AS "n"
     FROM "directives" d
     JOIN "rencontres" r ON r."id" = d."rencontreId"
     ${whereSql}
     GROUP BY 1
     ORDER BY 1 ASC`,
    params,
  );
  return rows.map((r) => ({ mois: r.mois, nb: Number(r.n) }));
}

// =============================================================================
// CHART 3 : Répartition par type de rencontre (donut)
// =============================================================================
export interface DirectivesParType {
  typeRencontre: string;
  nb: number;
}
export async function getDirectivesParType(
  filters: VisuFilters,
): Promise<DirectivesParType[]> {
  // Pour ce chart on ignore le filtre typeRencontre (sinon il ne montrerait
  // qu'une seule barre), mais on respecte annee/anneeMode.
  const params: (string | number)[] = [];
  let whereAnnee = '';
  if (filters.annee !== undefined) {
    params.push(filters.annee);
    whereAnnee = `WHERE ${directiveAnneeClause(filters.anneeMode, params.length, filters.creeEnAnneeOnly ?? false)}`;
  }
  const rows = await queryAll<{ typeRencontre: string; n: string }>(
    `SELECT r."typeRencontre", COUNT(*)::TEXT AS "n"
     FROM "directives" d
     JOIN "rencontres" r ON r."id" = d."rencontreId"
     ${whereAnnee}
     GROUP BY r."typeRencontre"
     ORDER BY COUNT(*) DESC`,
    params,
  );
  return rows.map((r) => ({ typeRencontre: r.typeRencontre, nb: Number(r.n) }));
}

// =============================================================================
// CHART 4 : Heatmap mois d'échéance × état
// =============================================================================
export interface DirectivesHeatmapCell {
  mois: number; // 1..12
  etat: string;
  nb: number;
}
export async function getDirectivesHeatmapEcheance(
  filters: VisuFilters,
): Promise<DirectivesHeatmapCell[]> {
  const { whereSql, params } = buildDirectiveWhere(filters);
  // On ne considère que les directives qui ONT une échéance
  const extraWhere = whereSql
    ? `${whereSql} AND d."echeance" IS NOT NULL`
    : `WHERE d."echeance" IS NOT NULL`;
  const rows = await queryAll<{ mois: string; etat: string; n: string }>(
    `SELECT EXTRACT(MONTH FROM d."echeance")::TEXT AS "mois",
            d."etat",
            COUNT(*)::TEXT AS "n"
     FROM "directives" d
     JOIN "rencontres" r ON r."id" = d."rencontreId"
     ${extraWhere}
     GROUP BY 1, 2
     ORDER BY 1, 2`,
    params,
  );
  return rows.map((r) => ({
    mois: Number(r.mois),
    etat: r.etat,
    nb: Number(r.n),
  }));
}

// =============================================================================
// CHART 5 : Top 10 ministères associés (horizontal bar)
// =============================================================================
export interface TopMinistere {
  ministere: string;
  nb: number;
}
export async function getTopMinisteres(
  filters: VisuFilters,
): Promise<TopMinistere[]> {
  const { whereSql, params } = buildDirectiveWhere(filters);
  const rows = await queryAll<{ ministere: string; n: string }>(
    `SELECT UNNEST(d."ministeresAssocies") AS "ministere",
            COUNT(*)::TEXT AS "n"
     FROM "directives" d
     JOIN "rencontres" r ON r."id" = d."rencontreId"
     ${whereSql}
     GROUP BY 1
     ORDER BY COUNT(*) DESC
     LIMIT 10`,
    params,
  );
  return rows.map((r) => ({ ministere: r.ministere, nb: Number(r.n) }));
}

// =============================================================================
// CHART 6 : Délai prévu vs réel par type de rencontre (grouped bar)
// =============================================================================
export interface DelaiParType {
  typeRencontre: string;
  joursPrevuMoy: number;
  joursReelMoy: number;
  nbAvecDonnees: number;
}
export async function getDelaiParType(
  filters: VisuFilters,
): Promise<DelaiParType[]> {
  const params: (string | number)[] = [];
  const conditions: string[] = [
    `(d."joursPrevu" IS NOT NULL OR d."joursReel" IS NOT NULL)`,
  ];
  if (filters.annee !== undefined) {
    params.push(filters.annee);
    conditions.push(
      directiveAnneeClause(filters.anneeMode, params.length, filters.creeEnAnneeOnly ?? false),
    );
  }
  const rows = await queryAll<{
    typeRencontre: string;
    prevuMoy: string | null;
    reelMoy: string | null;
    nb: string;
  }>(
    `SELECT r."typeRencontre",
            AVG(d."joursPrevu")::NUMERIC(10,1)::TEXT AS "prevuMoy",
            AVG(d."joursReel")::NUMERIC(10,1)::TEXT AS "reelMoy",
            COUNT(*)::TEXT AS "nb"
     FROM "directives" d
     JOIN "rencontres" r ON r."id" = d."rencontreId"
     WHERE ${conditions.join(' AND ')}
     GROUP BY r."typeRencontre"
     ORDER BY r."typeRencontre"`,
    params,
  );
  return rows.map((r) => ({
    typeRencontre: r.typeRencontre,
    joursPrevuMoy: r.prevuMoy ? Number(r.prevuMoy) : 0,
    joursReelMoy: r.reelMoy ? Number(r.reelMoy) : 0,
    nbAvecDonnees: Number(r.nb),
  }));
}

// =============================================================================
// CHART 7 : Funnel attente → en cours → réalisée
// =============================================================================
export interface FunnelEtape {
  etat: string;
  nb: number;
}
export async function getDirectivesFunnel(
  filters: VisuFilters,
): Promise<FunnelEtape[]> {
  const { whereSql, params } = buildDirectiveWhere(filters);
  const row = await queryAll<{
    attente: string;
    enCours: string;
    realisee: string;
    ineligible: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE d."etat" = 'attente')::TEXT    AS "attente",
       COUNT(*) FILTER (WHERE d."etat" = 'enCours')::TEXT    AS "enCours",
       COUNT(*) FILTER (WHERE d."etat" = 'realisee')::TEXT   AS "realisee",
       COUNT(*) FILTER (WHERE d."etat" = 'ineligible')::TEXT AS "ineligible"
     FROM "directives" d
     JOIN "rencontres" r ON r."id" = d."rencontreId"
     ${whereSql}`,
    params,
  );
  const r = row[0];
  if (!r) return [];
  return [
    { etat: 'attente', nb: Number(r.attente) },
    { etat: 'enCours', nb: Number(r.enCours) },
    { etat: 'realisee', nb: Number(r.realisee) },
    { etat: 'ineligible', nb: Number(r.ineligible) },
  ];
}

// =============================================================================
// CHART 8 : Recommandations par catégorie matrice × état (stacked bar)
// =============================================================================
export interface RecoParCategorie {
  categorie: string;
  attente: number;
  enCours: number;
  realisee: number;
  ineligible: number;
}
export async function getRecoParCategorie(): Promise<RecoParCategorie[]> {
  // Group by parentCode du referentiel : 'copil' (5 projets), 'reformes'
  // (assainissement + institutionnelle), 'cngi'. Plus lisible qu'un breakdown
  // par typeMatrice à 8 colonnes.
  const rows = await queryAll<{
    categorie: string;
    etat: string;
    n: string;
  }>(
    `SELECT COALESCE(ref."parentCode", rm."typeMatrice", 'autres') AS "categorie",
            rm."etat",
            COUNT(*)::TEXT AS "n"
     FROM "recommandationsMatrice" rm
     LEFT JOIN "referentiels" ref
       ON ref."codeType" = 'typeMatrice' AND ref."code" = rm."typeMatrice"
     GROUP BY 1, 2
     ORDER BY 1`,
  );
  const map = new Map<string, RecoParCategorie>();
  for (const row of rows) {
    if (!map.has(row.categorie)) {
      map.set(row.categorie, {
        categorie: row.categorie,
        attente: 0,
        enCours: 0,
        realisee: 0,
        ineligible: 0,
      });
    }
    const e = map.get(row.categorie)!;
    const n = Number(row.n);
    if (row.etat === 'attente') e.attente = n;
    else if (row.etat === 'enCours') e.enCours = n;
    else if (row.etat === 'realisee') e.realisee = n;
    else if (row.etat === 'ineligible') e.ineligible = n;
  }
  return Array.from(map.values());
}

// =============================================================================
// CHART 9 : Taux d'exécution par projet COPIL (bullet-style horizontal bar)
// =============================================================================
export interface TauxParProjet {
  projet: string;
  total: number;
  realisees: number;
  taux: number; // 0..100
}
export async function getTauxParProjet(): Promise<TauxParProjet[]> {
  // Les projets COPIL sont identifiés par typeMatrice = 'copilXxx'.
  // On joint le referentiel pour récupérer le libellé propre (PROGEP II,
  // PISEA, etc.) au lieu d'afficher le code technique.
  const rows = await queryAll<{
    projet: string;
    total: string;
    realisees: string;
  }>(
    `SELECT COALESCE(ref."label", rm."typeMatrice") AS "projet",
            COUNT(*)::TEXT AS "total",
            COUNT(*) FILTER (WHERE rm."etat" = 'realisee')::TEXT AS "realisees"
     FROM "recommandationsMatrice" rm
     LEFT JOIN "referentiels" ref
       ON ref."codeType" = 'typeMatrice' AND ref."code" = rm."typeMatrice"
     WHERE rm."typeMatrice" LIKE 'copil%'
     GROUP BY 1
     ORDER BY COUNT(*) DESC`,
  );
  return rows.map((r) => {
    const total = Number(r.total);
    const realisees = Number(r.realisees);
    return {
      projet: r.projet,
      total,
      realisees,
      taux: total > 0 ? Math.round((realisees / total) * 1000) / 10 : 0,
    };
  });
}

// =============================================================================
// CHART 10 : Évolution trimestrielle du backlog (en cours + en attente)
// =============================================================================
export interface BacklogTrimestre {
  trimestre: string; // 'YYYY-Tn'
  enAttente: number;
  enCours: number;
  total: number;
}
export async function getBacklogParTrimestre(
  filters: VisuFilters,
): Promise<BacklogTrimestre[]> {
  // On regarde le STOCK de directives non-closes à la fin de chaque trimestre
  // depuis 2024. Un directive est "en backlog au trimestre T" si :
  //   - elle a été émise avant fin T
  //   - ET son état est attente ou enCours
  //   - ET (echeance NULL ou echeance > début T) : pas encore close avant T
  // Approximation : on snapshote l'état CURRENT, on filtre par date d'émission.
  const params: (string | number)[] = [];
  let whereType = '';
  if (filters.typeRencontre) {
    params.push(filters.typeRencontre);
    whereType = `AND r."typeRencontre" = $${params.length}`;
  }
  const rows = await queryAll<{
    trimestre: string;
    enAttente: string;
    enCours: string;
  }>(
    `WITH trims AS (
       SELECT generate_series(
         DATE '2024-01-01',
         DATE_TRUNC('quarter', CURRENT_DATE),
         INTERVAL '3 months'
       ) AS t
     )
     SELECT EXTRACT(YEAR FROM t.t)::TEXT || '-T' || EXTRACT(QUARTER FROM t.t)::TEXT AS "trimestre",
            COUNT(*) FILTER (
              WHERE d."etat" = 'attente'
              AND r."dateRencontre" <= (t.t + INTERVAL '3 months' - INTERVAL '1 day')::DATE
            )::TEXT AS "enAttente",
            COUNT(*) FILTER (
              WHERE d."etat" = 'enCours'
              AND r."dateRencontre" <= (t.t + INTERVAL '3 months' - INTERVAL '1 day')::DATE
            )::TEXT AS "enCours"
     FROM trims t
     LEFT JOIN "directives" d ON TRUE
     LEFT JOIN "rencontres" r ON r."id" = d."rencontreId"
       ${whereType}
     GROUP BY 1
     ORDER BY 1`,
    params,
  );
  return rows.map((r) => {
    const enAttente = Number(r.enAttente);
    const enCours = Number(r.enCours);
    return {
      trimestre: r.trimestre,
      enAttente,
      enCours,
      total: enAttente + enCours,
    };
  });
}

// =============================================================================
// AGRÉGATEUR : retourne TOUS les datasets pour la page Directives
// =============================================================================
export interface DirectivesVisuPayload {
  filters: VisuFilters;
  etatParAnnee: DirectivesEtatParAnnee[];
  nouvellesParMois: DirectivesNouvellesParMois[];
  parType: DirectivesParType[];
  heatmapEcheance: DirectivesHeatmapCell[];
  topMinisteres: TopMinistere[];
  delaiParType: DelaiParType[];
  funnel: FunnelEtape[];
  backlogParTrimestre: BacklogTrimestre[];
}
export async function getDirectivesVisualisations(
  filters: VisuFilters,
): Promise<DirectivesVisuPayload> {
  const [
    etatParAnnee,
    nouvellesParMois,
    parType,
    heatmapEcheance,
    topMinisteres,
    delaiParType,
    funnel,
    backlogParTrimestre,
  ] = await Promise.all([
    getDirectivesEtatParAnnee(filters),
    getDirectivesNouvellesParMois(filters),
    getDirectivesParType(filters),
    getDirectivesHeatmapEcheance(filters),
    getTopMinisteres(filters),
    getDelaiParType(filters),
    getDirectivesFunnel(filters),
    getBacklogParTrimestre(filters),
  ]);
  return {
    filters,
    etatParAnnee,
    nouvellesParMois,
    parType,
    heatmapEcheance,
    topMinisteres,
    delaiParType,
    funnel,
    backlogParTrimestre,
  };
}

// =============================================================================
// AGRÉGATEUR : retourne TOUS les datasets pour la page Recommandations
// =============================================================================
export interface RecommandationsVisuPayload {
  parCategorie: RecoParCategorie[];
  tauxParProjet: TauxParProjet[];
}
export async function getRecommandationsVisualisations(): Promise<RecommandationsVisuPayload> {
  const [parCategorie, tauxParProjet] = await Promise.all([
    getRecoParCategorie(),
    getTauxParProjet(),
  ]);
  return { parCategorie, tauxParProjet };
}
