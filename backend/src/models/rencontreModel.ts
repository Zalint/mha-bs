import type { CreateRencontreInput, Rencontre, TypeRencontre } from '@mha-bs/shared';

import { queryAll, queryOne } from '../db/query.js';

interface RencontreRow {
  id: string;
  typeRencontre: TypeRencontre;
  codeRencontre: string;
  intitule: string;
  dateRencontre: Date;
  annee: number;
  copilName: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toRencontre(row: RencontreRow): Rencontre {
  return {
    id: row.id,
    typeRencontre: row.typeRencontre,
    codeRencontre: row.codeRencontre,
    intitule: row.intitule,
    dateRencontre: toYmd(row.dateRencontre),
    annee: row.annee,
    copilName: row.copilName,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface RencontreFilters {
  typeRencontre?: TypeRencontre;
  annee?: number;
  copilName?: string;
}

export async function listRencontres(filters: RencontreFilters = {}): Promise<Rencontre[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.typeRencontre) {
    params.push(filters.typeRencontre);
    conditions.push(`"typeRencontre" = $${params.length}`);
  }
  if (filters.annee) {
    params.push(filters.annee);
    conditions.push(`"annee" = $${params.length}`);
  }
  if (filters.copilName) {
    params.push(filters.copilName);
    conditions.push(`"copilName" = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await queryAll<RencontreRow>(
    `SELECT "id", "typeRencontre", "codeRencontre", "intitule", "dateRencontre",
            "annee", "copilName", "createdBy", "createdAt", "updatedAt"
     FROM "rencontres"
     ${where}
     ORDER BY "dateRencontre" DESC`,
    params,
  );
  return rows.map(toRencontre);
}

export async function findRencontreById(id: string): Promise<Rencontre | null> {
  const row = await queryOne<RencontreRow>(
    `SELECT "id", "typeRencontre", "codeRencontre", "intitule", "dateRencontre",
            "annee", "copilName", "createdBy", "createdAt", "updatedAt"
     FROM "rencontres" WHERE "id" = $1`,
    [id],
  );
  return row ? toRencontre(row) : null;
}

export async function createRencontre(input: CreateRencontreInput, createdBy: string): Promise<Rencontre> {
  const row = await queryOne<RencontreRow>(
    `INSERT INTO "rencontres" ("typeRencontre", "codeRencontre", "intitule", "dateRencontre", "annee", "copilName", "createdBy")
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING "id", "typeRencontre", "codeRencontre", "intitule", "dateRencontre",
               "annee", "copilName", "createdBy", "createdAt", "updatedAt"`,
    [
      input.typeRencontre,
      input.codeRencontre,
      input.intitule,
      input.dateRencontre,
      input.annee,
      input.copilName ?? null,
      createdBy,
    ],
  );
  if (!row) throw new Error('Echec creation rencontre');
  return toRencontre(row);
}
