import { queryAll, queryOne } from '../db/query.js';

export interface InterpellationWithDepute {
  id: string;
  reference: string;
  deputeId: string;
  deputeNom: string | null;
  deputeGroupe: string | null;
  sessionId: string | null;
  sessionIntitule: string | null;
  titre: string;
  description: string | null;
  typeInterpellation: string;
  dateReception: string;
  echeanceReponse: string | null;
  dateReponse: string | null;
  etat: string;
  texteReponse: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InterpellationRow {
  id: string;
  reference: string;
  deputeId: string;
  deputeNom: string | null;
  deputeGroupe: string | null;
  sessionId: string | null;
  sessionIntitule: string | null;
  titre: string;
  description: string | null;
  typeInterpellation: string;
  dateReception: Date;
  echeanceReponse: Date | null;
  dateReponse: Date | null;
  etat: string;
  texteReponse: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toYmd(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toInterpellation(row: InterpellationRow): InterpellationWithDepute {
  return {
    id: row.id,
    reference: row.reference,
    deputeId: row.deputeId,
    deputeNom: row.deputeNom,
    deputeGroupe: row.deputeGroupe,
    sessionId: row.sessionId,
    sessionIntitule: row.sessionIntitule,
    titre: row.titre,
    description: row.description,
    typeInterpellation: row.typeInterpellation,
    dateReception: toYmd(row.dateReception) ?? '',
    echeanceReponse: toYmd(row.echeanceReponse),
    dateReponse: toYmd(row.dateReponse),
    etat: row.etat,
    texteReponse: row.texteReponse,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const SELECT_INTERPELLATION = `
  i."id", i."reference", i."deputeId", d."nomComplet" AS "deputeNom",
  d."groupeParlementaire" AS "deputeGroupe",
  i."sessionId", s."intitule" AS "sessionIntitule",
  i."titre", i."description", i."typeInterpellation",
  i."dateReception", i."echeanceReponse", i."dateReponse",
  i."etat", i."texteReponse",
  i."createdAt", i."updatedAt"
`;

export async function listInterpellations(): Promise<InterpellationWithDepute[]> {
  const rows = await queryAll<InterpellationRow>(
    `SELECT ${SELECT_INTERPELLATION}
     FROM "interpellations" i
     LEFT JOIN "deputes" d ON d."id" = i."deputeId"
     LEFT JOIN "sessionsParlementaires" s ON s."id" = i."sessionId"
     ORDER BY i."dateReception" DESC, i."createdAt" DESC`,
  );
  return rows.map(toInterpellation);
}

export async function findInterpellationById(
  id: string,
): Promise<InterpellationWithDepute | null> {
  const row = await queryOne<InterpellationRow>(
    `SELECT ${SELECT_INTERPELLATION}
     FROM "interpellations" i
     LEFT JOIN "deputes" d ON d."id" = i."deputeId"
     LEFT JOIN "sessionsParlementaires" s ON s."id" = i."sessionId"
     WHERE i."id" = $1`,
    [id],
  );
  return row ? toInterpellation(row) : null;
}

export interface InterpellationStats {
  total: number;
  parEtat: Record<string, number>;
  parType: Record<string, number>;
  parGroupe: Record<string, number>;
}

export interface CreateInterpellationInput {
  reference: string;
  deputeId: string;
  sessionId?: string | null;
  titre: string;
  description?: string | null;
  typeInterpellation: string;
  dateReception: string;
  echeanceReponse?: string | null;
}

export async function createInterpellation(
  input: CreateInterpellationInput,
  createdBy: string,
): Promise<InterpellationWithDepute> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO "interpellations" (
       "reference", "deputeId", "sessionId", "titre", "description",
       "typeInterpellation", "dateReception", "echeanceReponse",
       "etat", "createdBy"
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'recue', $9)
     RETURNING "id"`,
    [
      input.reference,
      input.deputeId,
      input.sessionId ?? null,
      input.titre,
      input.description ?? null,
      input.typeInterpellation,
      input.dateReception,
      input.echeanceReponse ?? null,
      createdBy,
    ],
  );
  if (!row) throw new Error("Échec création interpellation");
  const created = await findInterpellationById(row.id);
  if (!created) throw new Error('Interpellation introuvable après création');
  return created;
}

export async function getInterpellationStats(): Promise<InterpellationStats> {
  const [etatRows, typeRows, groupeRows, totalRow] = await Promise.all([
    queryAll<{ etat: string; n: string }>(
      `SELECT "etat", COUNT(*)::TEXT AS "n" FROM "interpellations" GROUP BY "etat"`,
    ),
    queryAll<{ typeInterpellation: string; n: string }>(
      `SELECT "typeInterpellation", COUNT(*)::TEXT AS "n"
       FROM "interpellations" GROUP BY "typeInterpellation"`,
    ),
    queryAll<{ groupe: string | null; n: string }>(
      `SELECT d."groupeParlementaire" AS "groupe", COUNT(*)::TEXT AS "n"
       FROM "interpellations" i
       LEFT JOIN "deputes" d ON d."id" = i."deputeId"
       GROUP BY d."groupeParlementaire"`,
    ),
    queryOne<{ n: string }>(`SELECT COUNT(*)::TEXT AS "n" FROM "interpellations"`),
  ]);
  const parEtat: Record<string, number> = {};
  for (const r of etatRows) parEtat[r.etat] = Number(r.n);
  const parType: Record<string, number> = {};
  for (const r of typeRows) parType[r.typeInterpellation] = Number(r.n);
  const parGroupe: Record<string, number> = {};
  for (const r of groupeRows) parGroupe[r.groupe ?? '—'] = Number(r.n);
  return {
    total: totalRow ? Number(totalRow.n) : 0,
    parEtat,
    parType,
    parGroupe,
  };
}
