import { queryAll, queryOne } from '../db/query.js';

export interface DeputeRow {
  id: string;
  nomComplet: string;
  sexe: 'M' | 'F' | null;
  groupeParlementaire: string;
  region: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicDepute {
  id: string;
  nomComplet: string;
  sexe: 'M' | 'F' | null;
  groupeParlementaire: string;
  region: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function toPublic(row: DeputeRow): PublicDepute {
  return {
    id: row.id,
    nomComplet: row.nomComplet,
    sexe: row.sexe,
    groupeParlementaire: row.groupeParlementaire,
    region: row.region,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const SELECT_COLS = `
  "id", "nomComplet", "sexe", "groupeParlementaire", "region",
  "isActive", "createdAt", "updatedAt"
`;

export async function listDeputes(includeInactive = false): Promise<PublicDepute[]> {
  const where = includeInactive ? '' : 'WHERE "isActive" = TRUE';
  const rows = await queryAll<DeputeRow>(
    `SELECT ${SELECT_COLS} FROM "deputes" ${where} ORDER BY "nomComplet" ASC`,
  );
  return rows.map(toPublic);
}

export interface CreateDeputeInput {
  nomComplet: string;
  sexe?: 'M' | 'F' | null;
  groupeParlementaire: string;
  region?: string | null;
}

export async function createDepute(input: CreateDeputeInput): Promise<PublicDepute> {
  const row = await queryOne<DeputeRow>(
    `INSERT INTO "deputes" ("nomComplet", "sexe", "groupeParlementaire", "region")
     VALUES ($1, $2, $3, $4)
     RETURNING ${SELECT_COLS}`,
    [input.nomComplet, input.sexe ?? null, input.groupeParlementaire, input.region ?? null],
  );
  if (!row) throw new Error('Échec création député');
  return toPublic(row);
}
