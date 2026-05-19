import type { Direction } from '@mha-bs/shared';

import { queryAll, queryOne } from '../db/query.js';

interface DirectionRow extends Omit<Direction, 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
}

function toDirection(row: DirectionRow): Direction {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listDirections(includeInactive = false): Promise<Direction[]> {
  const sql = `SELECT "id", "code", "fullName", "typeEntite", "color",
                      "ordreAffichage", "isActive", "createdAt", "updatedAt"
               FROM "directions"
               ${includeInactive ? '' : 'WHERE "isActive" = TRUE'}
               ORDER BY "ordreAffichage" ASC, "code" ASC`;
  const rows = await queryAll<DirectionRow>(sql);
  return rows.map(toDirection);
}

export async function findDirectionById(id: number): Promise<Direction | null> {
  const row = await queryOne<DirectionRow>(
    `SELECT "id", "code", "fullName", "typeEntite", "color",
            "ordreAffichage", "isActive", "createdAt", "updatedAt"
     FROM "directions" WHERE "id" = $1`,
    [id],
  );
  return row ? toDirection(row) : null;
}
