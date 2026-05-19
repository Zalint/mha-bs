import type { QueryResult, QueryResultRow } from 'pg';

import { pool } from './pool.js';

/**
 * Helper de requête paramétrée. Aucun string interpolation autorisé : on passe les paramètres
 * via le tableau `params` pour éviter toute injection SQL.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(sql, params);
}

/**
 * Retourne la première ligne ou null. Pratique pour les findById, findByCode, etc.
 */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const result = await pool.query<T>(sql, params);
  return result.rows[0] ?? null;
}

/**
 * Retourne toutes les lignes.
 */
export async function queryAll<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(sql, params);
  return result.rows;
}
