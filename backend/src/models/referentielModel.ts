import { query, queryAll, queryOne } from '../db/query.js';

export interface ReferentielRow {
  id: string;
  codeType: string;
  code: string;
  label: string;
  description: string | null;
  parentCode: string | null;
  ordreAffichage: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicReferentiel {
  id: string;
  codeType: string;
  code: string;
  label: string;
  description: string | null;
  parentCode: string | null;
  ordreAffichage: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function toPublic(row: ReferentielRow): PublicReferentiel {
  return {
    id: row.id,
    codeType: row.codeType,
    code: row.code,
    label: row.label,
    description: row.description,
    parentCode: row.parentCode,
    ordreAffichage: row.ordreAffichage,
    isActive: row.isActive,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const SELECT_COLS = `
  "id", "codeType", "code", "label", "description", "parentCode",
  "ordreAffichage", "isActive", "createdBy", "createdAt", "updatedAt"
`;

export async function listReferentiels(codeType?: string, includeInactive = false): Promise<PublicReferentiel[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (codeType) {
    params.push(codeType);
    conditions.push(`"codeType" = $${params.length}`);
  }
  if (!includeInactive) conditions.push(`"isActive" = TRUE`);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await queryAll<ReferentielRow>(
    `SELECT ${SELECT_COLS} FROM "referentiels"
     ${where}
     ORDER BY "codeType" ASC, "ordreAffichage" ASC, "label" ASC`,
    params,
  );
  return rows.map(toPublic);
}

export async function listTypes(): Promise<string[]> {
  const rows = await queryAll<{ codeType: string }>(
    `SELECT DISTINCT "codeType" FROM "referentiels" ORDER BY "codeType"`,
  );
  return rows.map((r) => r.codeType);
}

export interface CreateReferentielInput {
  codeType: string;
  code: string;
  label: string;
  description?: string | null;
  parentCode?: string | null;
  ordreAffichage?: number;
}

export async function createReferentiel(
  input: CreateReferentielInput,
  createdBy: string,
): Promise<PublicReferentiel> {
  const row = await queryOne<ReferentielRow>(
    `INSERT INTO "referentiels" ("codeType", "code", "label", "description", "parentCode", "ordreAffichage", "createdBy")
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${SELECT_COLS}`,
    [
      input.codeType,
      input.code,
      input.label,
      input.description ?? null,
      input.parentCode ?? null,
      input.ordreAffichage ?? 100,
      createdBy,
    ],
  );
  if (!row) throw new Error('Echec creation referentiel');
  return toPublic(row);
}

export interface UpdateReferentielInput {
  label?: string;
  description?: string | null;
  parentCode?: string | null;
  ordreAffichage?: number;
  isActive?: boolean;
}

export async function updateReferentiel(id: string, input: UpdateReferentielInput): Promise<PublicReferentiel> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, value: unknown): void => {
    params.push(value);
    sets.push(`"${col}" = $${params.length}`);
  };
  if (input.label !== undefined) push('label', input.label);
  if (input.description !== undefined) push('description', input.description);
  if (input.parentCode !== undefined) push('parentCode', input.parentCode);
  if (input.ordreAffichage !== undefined) push('ordreAffichage', input.ordreAffichage);
  if (input.isActive !== undefined) push('isActive', input.isActive);
  if (sets.length === 0) throw new Error('Aucun champ a mettre a jour');

  params.push(id);
  const row = await queryOne<ReferentielRow>(
    `UPDATE "referentiels" SET ${sets.join(', ')}
     WHERE "id" = $${params.length}
     RETURNING ${SELECT_COLS}`,
    params,
  );
  if (!row) throw new Error('Referentiel introuvable');
  return toPublic(row);
}

export async function deleteReferentiel(id: string): Promise<void> {
  await query(`DELETE FROM "referentiels" WHERE "id" = $1`, [id]);
}
