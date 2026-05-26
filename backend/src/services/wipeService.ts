/**
 * Service de remise à zéro de la base — usage admin uniquement.
 *
 * Vide les tables transactionnelles (directives, recommandations, réunions,
 * missions, interpellations…) tout en préservant :
 *   - les utilisateurs (sinon admin perd son accès)
 *   - les référentiels (catégories, types, etc. — sinon il faudrait re-seed)
 *   - les directions, députés, sessions parlementaires (référentiels stables)
 *
 * Idéalement appelé après un export complet pour conserver une copie.
 */
import { queryAll, query } from '../db/query.js';

const TABLES_TO_WIPE = [
  // Ordre n'importe pas avec CASCADE, mais on liste explicitement pour audit.
  'commentaires',
  'piecesJointes',
  'interpellations',
  'ouvragesVisites',
  'missionsTerrain',
  'reunionsTechniques',
  'recommandationsMatrice',
  'directives',
  'rencontres',
  'auditLog',
  'alertes',
  'exports',
] as const;

export interface WipeCounts {
  [table: string]: number;
}

/**
 * Récupère les comptes lignes avant wipe pour donner un résumé honnête.
 */
async function countBefore(): Promise<WipeCounts> {
  const counts: WipeCounts = {};
  for (const table of TABLES_TO_WIPE) {
    const rows = await queryAll<{ n: string }>(`SELECT COUNT(*)::TEXT AS "n" FROM "${table}"`);
    counts[table] = Number(rows[0]?.n ?? 0);
  }
  return counts;
}

/**
 * Vide les tables transactionnelles. Utilise TRUNCATE … RESTART IDENTITY CASCADE
 * pour gérer les FK et remettre les séquences à zéro.
 */
export async function wipeDatabase(): Promise<{
  before: WipeCounts;
  totalDeleted: number;
  tables: string[];
}> {
  const before = await countBefore();
  const totalDeleted = Object.values(before).reduce((sum, n) => sum + n, 0);

  // Une seule requête TRUNCATE avec toutes les tables — CASCADE gère les FK.
  const tablesQuoted = TABLES_TO_WIPE.map((t) => `"${t}"`).join(', ');
  await query(`TRUNCATE TABLE ${tablesQuoted} RESTART IDENTITY CASCADE`);

  return {
    before,
    totalDeleted,
    tables: [...TABLES_TO_WIPE],
  };
}
