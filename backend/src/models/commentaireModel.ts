import { queryAll, queryOne } from '../db/query.js';

export interface CommentaireRow {
  id: string;
  entiteType: string;
  entiteId: string;
  texte: string;
  auteurId: string | null;
  createdAt: Date;
}

export interface PublicCommentaire {
  id: string;
  entiteType: string;
  entiteId: string;
  texte: string;
  auteurId: string | null;
  auteurFullName: string | null;
  createdAt: string;
}

interface JoinedRow extends CommentaireRow {
  auteurFullName: string | null;
}

function toPublic(row: JoinedRow): PublicCommentaire {
  return {
    id: row.id,
    entiteType: row.entiteType,
    entiteId: row.entiteId,
    texte: row.texte,
    auteurId: row.auteurId,
    auteurFullName: row.auteurFullName,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listCommentaires(entiteType: string, entiteId: string): Promise<PublicCommentaire[]> {
  const rows = await queryAll<JoinedRow>(
    `SELECT c."id", c."entiteType", c."entiteId", c."texte", c."auteurId",
            u."fullName" AS "auteurFullName", c."createdAt"
     FROM "commentaires" c
     LEFT JOIN "users" u ON u."id" = c."auteurId"
     WHERE c."entiteType" = $1 AND c."entiteId" = $2
     ORDER BY c."createdAt" DESC`,
    [entiteType, entiteId],
  );
  return rows.map(toPublic);
}

export async function createCommentaire(
  entiteType: string,
  entiteId: string,
  texte: string,
  auteurId: string,
): Promise<PublicCommentaire> {
  const inserted = await queryOne<{ id: string; createdAt: Date }>(
    `INSERT INTO "commentaires" ("entiteType", "entiteId", "texte", "auteurId")
     VALUES ($1, $2, $3, $4)
     RETURNING "id", "createdAt"`,
    [entiteType, entiteId, texte, auteurId],
  );
  if (!inserted) throw new Error('Echec creation commentaire');

  const row = await queryOne<JoinedRow>(
    `SELECT c."id", c."entiteType", c."entiteId", c."texte", c."auteurId",
            u."fullName" AS "auteurFullName", c."createdAt"
     FROM "commentaires" c
     LEFT JOIN "users" u ON u."id" = c."auteurId"
     WHERE c."id" = $1`,
    [inserted.id],
  );
  if (!row) throw new Error('Commentaire introuvable apres insertion');
  return toPublic(row);
}
