/**
 * Modèle Alertes — gestion des alertes utilisateur.
 *
 * Auto-génération : on crée des alertes pour les directives en retard
 * et les COPIL en dessous de la cible. Les alertes ont une clé naturelle
 * (sourceEntiteType, sourceEntiteId, codeRegle) pour éviter les doublons.
 */
import { query, queryAll, queryOne } from '../db/query.js';

export type AlerteCategorie = 'critique' | 'warning' | 'info';

export interface Alerte {
  id: string;
  userId: string;
  categorie: AlerteCategorie;
  titre: string;
  description: string | null;
  sourceEntiteType: string | null;
  sourceEntiteId: string | null;
  lue: boolean;
  createdAt: string;
}

interface AlerteRow {
  id: string;
  userId: string;
  categorie: AlerteCategorie;
  titre: string;
  description: string | null;
  sourceEntiteType: string | null;
  sourceEntiteId: string | null;
  lue: boolean;
  createdAt: Date;
}

function toAlerte(row: AlerteRow): Alerte {
  return {
    id: row.id,
    userId: row.userId,
    categorie: row.categorie,
    titre: row.titre,
    description: row.description,
    sourceEntiteType: row.sourceEntiteType,
    sourceEntiteId: row.sourceEntiteId,
    lue: row.lue,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAlertes(
  userId: string,
  filters: { lue?: boolean; categorie?: AlerteCategorie } = {},
): Promise<Alerte[]> {
  const conditions: string[] = ['"userId" = $1'];
  const params: unknown[] = [userId];
  if (filters.lue !== undefined) {
    params.push(filters.lue);
    conditions.push(`"lue" = $${params.length}`);
  }
  if (filters.categorie) {
    params.push(filters.categorie);
    conditions.push(`"categorie" = $${params.length}`);
  }
  const rows = await queryAll<AlerteRow>(
    `SELECT "id", "userId", "categorie", "titre", "description",
            "sourceEntiteType", "sourceEntiteId", "lue", "createdAt"
     FROM "alertes"
     WHERE ${conditions.join(' AND ')}
     ORDER BY "lue" ASC, "categorie" ASC, "createdAt" DESC
     LIMIT 200`,
    params,
  );
  return rows.map(toAlerte);
}

export async function countUnread(userId: string): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT COUNT(*)::TEXT AS "n" FROM "alertes" WHERE "userId" = $1 AND "lue" = FALSE`,
    [userId],
  );
  return Number(row?.n ?? 0);
}

export async function markAsRead(id: string, userId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `UPDATE "alertes" SET "lue" = TRUE WHERE "id" = $1 AND "userId" = $2 RETURNING "id"`,
    [id, userId],
  );
  return Boolean(row);
}

export async function markAllAsRead(userId: string): Promise<number> {
  const result = await query(
    `UPDATE "alertes" SET "lue" = TRUE WHERE "userId" = $1 AND "lue" = FALSE`,
    [userId],
  );
  return result.rowCount ?? 0;
}

export async function deleteAlerte(id: string, userId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `DELETE FROM "alertes" WHERE "id" = $1 AND "userId" = $2 RETURNING "id"`,
    [id, userId],
  );
  return Boolean(row);
}

/**
 * Insère une alerte si une alerte similaire (meme source + meme regle)
 * n'existe pas déjà pour cet utilisateur. Évite la duplication au fil des
 * exécutions répétées de la génération.
 */
async function createIfNotExists(input: {
  userId: string;
  categorie: AlerteCategorie;
  titre: string;
  description: string | null;
  sourceEntiteType: string;
  sourceEntiteId: string;
}): Promise<boolean> {
  const exists = await queryOne<{ id: string }>(
    `SELECT "id" FROM "alertes"
     WHERE "userId" = $1
       AND "sourceEntiteType" = $2
       AND "sourceEntiteId" = $3
       AND "titre" = $4
     LIMIT 1`,
    [input.userId, input.sourceEntiteType, input.sourceEntiteId, input.titre],
  );
  if (exists) return false;
  await query(
    `INSERT INTO "alertes" ("userId", "categorie", "titre", "description", "sourceEntiteType", "sourceEntiteId")
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.userId,
      input.categorie,
      input.titre,
      input.description,
      input.sourceEntiteType,
      input.sourceEntiteId,
    ],
  );
  return true;
}

interface GenerationStats {
  retardsDirectives: number;
  copilSousObjectif: number;
  recommandationsAttenteLongue: number;
  total: number;
}

/**
 * Génère les alertes pour un utilisateur sur la base de l'état courant
 * de la base. Idempotent : ne re-crée pas une alerte déjà existante avec
 * le même titre et la même source.
 *
 * Règles :
 *  1. Directive en cours/attente avec échéance dépassée → critique
 *  2. Projet COPIL avec taux d'exécution < 30% → warning
 *  3. Recommandation en attente depuis > 90 jours → info
 */
export async function generateAlertesForUser(userId: string): Promise<GenerationStats> {
  const stats: GenerationStats = {
    retardsDirectives: 0,
    copilSousObjectif: 0,
    recommandationsAttenteLongue: 0,
    total: 0,
  };

  // === 1. Directives en retard ===
  const directivesRetard = await queryAll<{
    id: string;
    codeDirective: string;
    texteDirective: string;
    echeance: Date;
    joursRetard: string;
  }>(
    `SELECT "id", "codeDirective", "texteDirective", "echeance",
            (CURRENT_DATE - "echeance")::TEXT AS "joursRetard"
     FROM "directives"
     WHERE "etat" IN ('enCours', 'attente')
       AND "echeance" IS NOT NULL
       AND "echeance" < CURRENT_DATE
     ORDER BY "echeance" ASC
     LIMIT 50`,
  );
  for (const d of directivesRetard) {
    const created = await createIfNotExists({
      userId,
      categorie: 'critique',
      titre: `Directive en retard · ${d.codeDirective}`,
      description: `${d.texteDirective.slice(0, 200)}${d.texteDirective.length > 200 ? '…' : ''} (retard : ${d.joursRetard} jours)`,
      sourceEntiteType: 'directive',
      sourceEntiteId: d.id,
    });
    if (created) stats.retardsDirectives++;
  }

  // === 2. COPIL sous-objectif (< 30% d'exécution) ===
  const COPIL_TARGET = 30;
  const copilSousObjectif = await queryAll<{
    code: string;
    label: string;
    total: string;
    realisees: string;
    pct: string;
  }>(
    `SELECT r."code", r."label",
            COUNT(m.*)::TEXT AS "total",
            COUNT(m.*) FILTER (WHERE m."etat" = 'realisee')::TEXT AS "realisees",
            CASE WHEN COUNT(m.*) > 0
              THEN (COUNT(m.*) FILTER (WHERE m."etat" = 'realisee') * 100 / COUNT(m.*))::TEXT
              ELSE '0'
            END AS "pct"
     FROM "referentiels" r
     LEFT JOIN "recommandationsMatrice" m ON m."typeMatrice" = r."code"
     WHERE r."codeType" = 'typeMatrice'
       AND r."isActive" = TRUE
       AND (COALESCE(r."parentCode", '') = 'copil' OR r."code" LIKE 'copil%')
     GROUP BY r."code", r."label"
     HAVING COUNT(m.*) > 0
        AND (COUNT(m.*) FILTER (WHERE m."etat" = 'realisee') * 100 / COUNT(m.*)) < $1`,
    [COPIL_TARGET],
  );
  for (const c of copilSousObjectif) {
    const created = await createIfNotExists({
      userId,
      categorie: 'warning',
      titre: `Projet COPIL sous objectif · ${c.label}`,
      description: `Taux d'exécution : ${c.pct}% (cible 60%). ${c.realisees} / ${c.total} recommandations réalisées.`,
      sourceEntiteType: 'copilProjet',
      sourceEntiteId: c.code,
    });
    if (created) stats.copilSousObjectif++;
  }

  // === 3. Recommandations en attente > 90 jours ===
  const recosLongues = await queryAll<{
    id: string;
    typeMatrice: string;
    numOrdre: number;
    texteRecommandation: string;
    joursAttente: string;
  }>(
    `SELECT m."id", m."typeMatrice", m."numOrdre", m."texteRecommandation",
            (CURRENT_DATE - m."createdAt"::DATE)::TEXT AS "joursAttente"
     FROM "recommandationsMatrice" m
     WHERE m."etat" = 'attente'
       AND m."createdAt" < (CURRENT_DATE - INTERVAL '90 days')
     ORDER BY m."createdAt" ASC
     LIMIT 30`,
  );
  for (const r of recosLongues) {
    const created = await createIfNotExists({
      userId,
      categorie: 'info',
      titre: `Recommandation en attente · ${r.typeMatrice} #${r.numOrdre}`,
      description: `${r.texteRecommandation.slice(0, 200)}${r.texteRecommandation.length > 200 ? '…' : ''} (en attente depuis ${r.joursAttente} jours)`,
      sourceEntiteType: 'recommandation',
      sourceEntiteId: r.id,
    });
    if (created) stats.recommandationsAttenteLongue++;
  }

  stats.total =
    stats.retardsDirectives + stats.copilSousObjectif + stats.recommandationsAttenteLongue;
  return stats;
}
