import type { CreateReunionTechniqueInput, ReunionTechnique, SousSecteur } from '@mha-bs/shared';

import { query, queryAll, queryOne } from '../db/query.js';

interface ReunionRow {
  id: string;
  dateReunion: Date;
  heureDebut: string | null;
  dureeEstimee: string | null;
  theme: string;
  lieu: string | null;
  sousSecteur: SousSecteur | null;
  copilLie: string | null;
  ordreDuJour: string | null;
  decisions: string | null;
  participants: string[];
  visibleSg: boolean;
  inclusRapportHebdo: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toYmd(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

function toReunion(row: ReunionRow): ReunionTechnique {
  return {
    id: row.id,
    dateReunion: toYmd(row.dateReunion),
    heureDebut: row.heureDebut,
    dureeEstimee: row.dureeEstimee,
    theme: row.theme,
    lieu: row.lieu,
    sousSecteur: row.sousSecteur,
    copilLie: row.copilLie,
    ordreDuJour: row.ordreDuJour,
    decisions: row.decisions,
    participants: Array.isArray(row.participants) ? row.participants : [],
    visibleSg: row.visibleSg,
    inclusRapportHebdo: row.inclusRapportHebdo,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const SELECT_COLS = `
  "id", "dateReunion", "heureDebut", "dureeEstimee", "theme", "lieu",
  "sousSecteur", "copilLie", "ordreDuJour", "decisions", "participants",
  "visibleSg", "inclusRapportHebdo",
  "createdBy", "createdAt", "updatedAt"
`;

export async function listReunions(filters: { sousSecteur?: SousSecteur } = {}): Promise<ReunionTechnique[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.sousSecteur) {
    params.push(filters.sousSecteur);
    conditions.push(`"sousSecteur" = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await queryAll<ReunionRow>(
    `SELECT ${SELECT_COLS} FROM "reunionsTechniques" ${where}
     ORDER BY "dateReunion" DESC`,
    params,
  );
  return rows.map(toReunion);
}

export async function findReunionById(id: string): Promise<ReunionTechnique | null> {
  const row = await queryOne<ReunionRow>(
    `SELECT ${SELECT_COLS} FROM "reunionsTechniques" WHERE "id" = $1`,
    [id],
  );
  return row ? toReunion(row) : null;
}

export async function createReunion(
  input: CreateReunionTechniqueInput,
  createdBy: string,
): Promise<ReunionTechnique> {
  const row = await queryOne<ReunionRow>(
    `INSERT INTO "reunionsTechniques" (
       "dateReunion", "heureDebut", "dureeEstimee", "theme", "lieu",
       "sousSecteur", "copilLie", "ordreDuJour", "decisions", "participants",
       "visibleSg", "inclusRapportHebdo", "createdBy"
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13)
     RETURNING ${SELECT_COLS}`,
    [
      input.dateReunion,
      input.heureDebut,
      input.dureeEstimee,
      input.theme,
      input.lieu,
      input.sousSecteur,
      input.copilLie,
      input.ordreDuJour,
      input.decisions,
      JSON.stringify(input.participants ?? []),
      input.visibleSg ?? true,
      input.inclusRapportHebdo ?? false,
      createdBy,
    ],
  );
  if (!row) throw new Error('Echec creation reunion');
  return toReunion(row);
}

export async function updateReunion(
  id: string,
  input: Partial<CreateReunionTechniqueInput>,
): Promise<ReunionTechnique> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, value: unknown, json = false): void => {
    params.push(json ? JSON.stringify(value) : value);
    const cast = json ? '::jsonb' : '';
    sets.push(`"${col}" = $${params.length}${cast}`);
  };
  if (input.dateReunion !== undefined) push('dateReunion', input.dateReunion);
  if (input.heureDebut !== undefined) push('heureDebut', input.heureDebut);
  if (input.dureeEstimee !== undefined) push('dureeEstimee', input.dureeEstimee);
  if (input.theme !== undefined) push('theme', input.theme);
  if (input.lieu !== undefined) push('lieu', input.lieu);
  if (input.sousSecteur !== undefined) push('sousSecteur', input.sousSecteur);
  if (input.copilLie !== undefined) push('copilLie', input.copilLie);
  if (input.ordreDuJour !== undefined) push('ordreDuJour', input.ordreDuJour);
  if (input.decisions !== undefined) push('decisions', input.decisions);
  if (input.participants !== undefined) push('participants', input.participants, true);
  if (input.visibleSg !== undefined) push('visibleSg', input.visibleSg);
  if (input.inclusRapportHebdo !== undefined) push('inclusRapportHebdo', input.inclusRapportHebdo);

  if (sets.length === 0) throw new Error('Aucun champ a mettre a jour');
  params.push(id);
  const row = await queryOne<ReunionRow>(
    `UPDATE "reunionsTechniques" SET ${sets.join(', ')}
     WHERE "id" = $${params.length}
     RETURNING ${SELECT_COLS}`,
    params,
  );
  if (!row) throw new Error('Reunion introuvable');
  return toReunion(row);
}

export async function deleteReunion(id: string): Promise<void> {
  await query(`DELETE FROM "reunionsTechniques" WHERE "id" = $1`, [id]);
}

export interface ReunionStatsBySousSecteur {
  sousSecteur: SousSecteur | null;
  count: number;
}

export async function getReunionStatsBySousSecteur(): Promise<ReunionStatsBySousSecteur[]> {
  const rows = await queryAll<{ sousSecteur: SousSecteur | null; cnt: string }>(
    `SELECT "sousSecteur", COUNT(*)::TEXT AS "cnt"
     FROM "reunionsTechniques"
     GROUP BY "sousSecteur"
     ORDER BY "cnt" DESC`,
  );
  return rows.map((r) => ({ sousSecteur: r.sousSecteur, count: Number(r.cnt) }));
}
