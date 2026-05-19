import type { DirectiveEtat, RecommandationMatrice, TypeMatrice } from '@mha-bs/shared';

import { query, queryAll, queryOne } from '../db/query.js';

interface MatriceRow {
  id: string;
  typeMatrice: TypeMatrice;
  numOrdre: number;
  texteRecommandation: string;
  etat: DirectiveEtat;
  observations: string | null;
  echeanceTrimestre: 'T1' | 'T2' | 'T3' | 'T4' | null;
  priorite: 'urgent' | 'prioritaire' | 'obligatoire' | 'standard' | null;
  responsableId: number | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toMatrice(row: MatriceRow): RecommandationMatrice {
  return {
    id: row.id,
    typeMatrice: row.typeMatrice,
    numOrdre: row.numOrdre,
    texteRecommandation: row.texteRecommandation,
    etat: row.etat,
    observations: row.observations,
    echeanceTrimestre: row.echeanceTrimestre,
    priorite: row.priorite,
    responsableId: row.responsableId,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const SELECT_COLS = `
  "id", "typeMatrice", "numOrdre", "texteRecommandation", "etat", "observations",
  "echeanceTrimestre", "priorite", "responsableId",
  "createdBy", "updatedBy", "createdAt", "updatedAt"
`;

export async function listByType(typeMatrice: TypeMatrice): Promise<RecommandationMatrice[]> {
  const rows = await queryAll<MatriceRow>(
    `SELECT ${SELECT_COLS} FROM "recommandationsMatrice"
     WHERE "typeMatrice" = $1
     ORDER BY "numOrdre" ASC`,
    [typeMatrice],
  );
  return rows.map(toMatrice);
}

export async function listAll(): Promise<RecommandationMatrice[]> {
  const rows = await queryAll<MatriceRow>(
    `SELECT ${SELECT_COLS} FROM "recommandationsMatrice"
     ORDER BY "typeMatrice", "numOrdre"`,
  );
  return rows.map(toMatrice);
}

export async function updateByOrder(
  typeMatrice: TypeMatrice,
  numOrdre: number,
  input: Partial<Pick<RecommandationMatrice, 'etat' | 'observations' | 'echeanceTrimestre' | 'priorite'>>,
  updatedBy: string,
): Promise<RecommandationMatrice> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, value: unknown): void => {
    params.push(value);
    sets.push(`"${col}" = $${params.length}`);
  };

  if (input.etat !== undefined) push('etat', input.etat);
  if (input.observations !== undefined) push('observations', input.observations);
  if (input.echeanceTrimestre !== undefined) push('echeanceTrimestre', input.echeanceTrimestre);
  if (input.priorite !== undefined) push('priorite', input.priorite);
  push('updatedBy', updatedBy);

  if (sets.length === 0) {
    throw new Error('Aucun champ à mettre à jour');
  }

  params.push(typeMatrice, numOrdre);
  const row = await queryOne<MatriceRow>(
    `UPDATE "recommandationsMatrice"
     SET ${sets.join(', ')}
     WHERE "typeMatrice" = $${params.length - 1} AND "numOrdre" = $${params.length}
     RETURNING ${SELECT_COLS}`,
    params,
  );
  if (!row) throw new Error('Recommandation introuvable');
  return toMatrice(row);
}

export interface MatriceStats {
  typeMatrice: TypeMatrice;
  total: number;
  nbAttente: number;
  nbEnCours: number;
  nbRealisees: number;
  nbIneligibles: number;
  tauxExecution: number;
}

export async function getStatsByType(): Promise<MatriceStats[]> {
  const rows = await queryAll<{
    typeMatrice: TypeMatrice;
    total: string;
    nbAttente: string;
    nbEnCours: string;
    nbRealisees: string;
    nbIneligibles: string;
  }>(
    `SELECT "typeMatrice",
            COUNT(*)::TEXT AS "total",
            COUNT(*) FILTER (WHERE "etat" = 'attente')::TEXT     AS "nbAttente",
            COUNT(*) FILTER (WHERE "etat" = 'enCours')::TEXT     AS "nbEnCours",
            COUNT(*) FILTER (WHERE "etat" = 'realisee')::TEXT    AS "nbRealisees",
            COUNT(*) FILTER (WHERE "etat" = 'ineligible')::TEXT  AS "nbIneligibles"
     FROM "recommandationsMatrice"
     GROUP BY "typeMatrice"`,
  );
  return rows.map((r) => {
    const total = Number(r.total);
    const real = Number(r.nbRealisees);
    return {
      typeMatrice: r.typeMatrice,
      total,
      nbAttente: Number(r.nbAttente),
      nbEnCours: Number(r.nbEnCours),
      nbRealisees: real,
      nbIneligibles: Number(r.nbIneligibles),
      tauxExecution: total > 0 ? Math.round((real / total) * 1000) / 10 : 0,
    };
  });
}

export async function deleteByTypeAndOrder(typeMatrice: TypeMatrice, numOrdre: number): Promise<void> {
  await query(
    `DELETE FROM "recommandationsMatrice"
     WHERE "typeMatrice" = $1 AND "numOrdre" = $2`,
    [typeMatrice, numOrdre],
  );
}
