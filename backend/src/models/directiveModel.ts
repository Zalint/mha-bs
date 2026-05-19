import type {
  CreateDirectiveInput,
  Directive,
  DirectiveEtat,
  DirectiveFilters,
  PaginatedResponse,
  StatutValidation,
  UpdateDirectiveInput,
} from '@mha-bs/shared';

import { query, queryAll, queryOne } from '../db/query.js';

interface DirectiveRow {
  id: string;
  rencontreId: string;
  codeDirective: string;
  texteDirective: string;
  responsableId: number | null;
  ministeresAssocies: string[];
  echeance: Date | null;
  debutExecution: Date | null;
  finExecution: Date | null;
  etat: DirectiveEtat;
  typeCause: string | null;
  joursPrevu: number | null;
  joursReel: number | null;
  joursRetardDemarrage: number | null;
  derniereDateTraitement: Date | null;
  commentaires: string | null;
  statutValidation: StatutValidation;
  validatedAt: Date | null;
  validatedBy: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toYmd(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toIso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function toDirective(row: DirectiveRow): Directive {
  return {
    id: row.id,
    rencontreId: row.rencontreId,
    codeDirective: row.codeDirective,
    texteDirective: row.texteDirective,
    responsableId: row.responsableId,
    ministeresAssocies: row.ministeresAssocies ?? [],
    echeance: toYmd(row.echeance),
    debutExecution: toYmd(row.debutExecution),
    finExecution: toYmd(row.finExecution),
    etat: row.etat,
    typeCause: row.typeCause,
    joursPrevu: row.joursPrevu,
    joursReel: row.joursReel,
    joursRetardDemarrage: row.joursRetardDemarrage,
    derniereDateTraitement: toYmd(row.derniereDateTraitement),
    commentaires: row.commentaires,
    statutValidation: row.statutValidation,
    validatedAt: toIso(row.validatedAt),
    validatedBy: row.validatedBy,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const SELECT_DIRECTIVE = `
  d."id", d."rencontreId", d."codeDirective", d."texteDirective", d."responsableId",
  d."ministeresAssocies", d."echeance", d."debutExecution", d."finExecution",
  d."etat", d."typeCause", d."joursPrevu", d."joursReel", d."joursRetardDemarrage",
  d."derniereDateTraitement", d."commentaires",
  d."statutValidation", d."validatedAt", d."validatedBy",
  d."createdBy", d."updatedBy", d."createdAt", d."updatedAt"
`;

export interface DirectiveSearchFilters extends DirectiveFilters {
  // Étend les filtres partagés avec un filtre par typeRencontre (filtré côté SQL via JOIN)
}

export async function listDirectives(
  filters: DirectiveSearchFilters,
): Promise<PaginatedResponse<Directive>> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.typeRencontre) {
    params.push(filters.typeRencontre);
    conditions.push(`r."typeRencontre" = $${params.length}`);
  }
  if (filters.etat) {
    params.push(filters.etat);
    conditions.push(`d."etat" = $${params.length}`);
  }
  if (filters.annee) {
    params.push(filters.annee);
    conditions.push(`r."annee" = $${params.length}`);
  }
  if (filters.rencontreId) {
    params.push(filters.rencontreId);
    conditions.push(`d."rencontreId" = $${params.length}`);
  }
  if (filters.responsableId) {
    params.push(filters.responsableId);
    conditions.push(`d."responsableId" = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(`d."texteDirective" ILIKE $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count
  const countResult = await queryOne<{ totalCount: string }>(
    `SELECT COUNT(*)::TEXT AS "totalCount"
     FROM "directives" d
     LEFT JOIN "rencontres" r ON r."id" = d."rencontreId"
     ${where}`,
    params,
  );
  const totalCount = countResult ? Number(countResult.totalCount) : 0;

  // Pagination
  const offset = (filters.page - 1) * filters.pageSize;
  params.push(filters.pageSize, offset);
  const rows = await queryAll<DirectiveRow>(
    `SELECT ${SELECT_DIRECTIVE}
     FROM "directives" d
     LEFT JOIN "rencontres" r ON r."id" = d."rencontreId"
     ${where}
     ORDER BY r."dateRencontre" DESC NULLS LAST, d."createdAt" DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return {
    items: rows.map(toDirective),
    totalCount,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function findDirectiveById(id: string): Promise<Directive | null> {
  const row = await queryOne<DirectiveRow>(
    `SELECT ${SELECT_DIRECTIVE}
     FROM "directives" d WHERE d."id" = $1`,
    [id],
  );
  return row ? toDirective(row) : null;
}

export async function createDirective(
  input: CreateDirectiveInput,
  createdBy: string,
): Promise<Directive> {
  const row = await queryOne<DirectiveRow>(
    `INSERT INTO "directives" (
       "rencontreId", "codeDirective", "texteDirective", "responsableId",
       "ministeresAssocies", "echeance", "debutExecution", "finExecution",
       "etat", "typeCause", "commentaires", "createdBy"
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING ${SELECT_DIRECTIVE.replace(/d\./g, '')}`,
    [
      input.rencontreId,
      input.codeDirective,
      input.texteDirective,
      input.responsableId,
      input.ministeresAssocies ?? [],
      input.echeance,
      input.debutExecution,
      input.finExecution,
      input.etat,
      input.typeCause,
      input.commentaires,
      createdBy,
    ],
  );
  if (!row) throw new Error('Echec creation directive');
  return toDirective(row);
}

export async function updateDirective(
  id: string,
  input: UpdateDirectiveInput,
  updatedBy: string,
): Promise<Directive> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, value: unknown): void => {
    params.push(value);
    sets.push(`"${col}" = $${params.length}`);
  };

  if (input.rencontreId !== undefined) push('rencontreId', input.rencontreId);
  if (input.codeDirective !== undefined) push('codeDirective', input.codeDirective);
  if (input.texteDirective !== undefined) push('texteDirective', input.texteDirective);
  if (input.responsableId !== undefined) push('responsableId', input.responsableId);
  if (input.ministeresAssocies !== undefined) push('ministeresAssocies', input.ministeresAssocies);
  if (input.echeance !== undefined) push('echeance', input.echeance);
  if (input.debutExecution !== undefined) push('debutExecution', input.debutExecution);
  if (input.finExecution !== undefined) push('finExecution', input.finExecution);
  if (input.etat !== undefined) push('etat', input.etat);
  if (input.typeCause !== undefined) push('typeCause', input.typeCause);
  if (input.commentaires !== undefined) push('commentaires', input.commentaires);

  push('updatedBy', updatedBy);
  push('derniereDateTraitement', new Date().toISOString().slice(0, 10));

  params.push(id);
  const row = await queryOne<DirectiveRow>(
    `UPDATE "directives" SET ${sets.join(', ')}
     WHERE "id" = $${params.length}
     RETURNING ${SELECT_DIRECTIVE.replace(/d\./g, '')}`,
    params,
  );
  if (!row) throw new Error('Directive introuvable');
  return toDirective(row);
}

export async function deleteDirective(id: string): Promise<void> {
  await query(`DELETE FROM "directives" WHERE "id" = $1`, [id]);
}

export async function submitDirective(id: string, userId: string): Promise<Directive> {
  const row = await queryOne<DirectiveRow>(
    `UPDATE "directives"
     SET "statutValidation" = 'soumis', "updatedBy" = $2
     WHERE "id" = $1
     RETURNING ${SELECT_DIRECTIVE.replace(/d\./g, '')}`,
    [id, userId],
  );
  if (!row) throw new Error('Directive introuvable');
  return toDirective(row);
}

export async function validateDirective(id: string, userId: string): Promise<Directive> {
  const row = await queryOne<DirectiveRow>(
    `UPDATE "directives"
     SET "statutValidation" = 'valide',
         "validatedAt" = NOW(),
         "validatedBy" = $2,
         "updatedBy" = $2
     WHERE "id" = $1
     RETURNING ${SELECT_DIRECTIVE.replace(/d\./g, '')}`,
    [id, userId],
  );
  if (!row) throw new Error('Directive introuvable');
  return toDirective(row);
}
