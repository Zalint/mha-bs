import type {
  CreateMissionTerrainInput,
  MissionTerrain,
  OuvrageVisite,
  RegionSenegal,
} from '@mha-bs/shared';

import { toYmd as ymd } from '../lib/dateOnly.js';

import { query, queryAll, queryOne } from '../db/query.js';

interface MissionRow {
  id: string;
  dateMission: Date;
  localite: string;
  region: RegionSenegal | null;
  latitude: string | null;
  longitude: string | null;
  projetRattache: string | null;
  constats: string | null;
  recommandations: string | null;
  /** Presents uniquement sur les requetes qui selectionnent les sous-totaux. */
  nbOuvrages?: number;
  ouvragesParType?: Record<string, number>;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface OuvrageRow {
  id: string;
  missionId: string;
  nomOuvrage: string;
  typeOuvrage: string | null;
  etatOuvrage: 'fonctionnel' | 'maintenance' | 'horsService' | 'enConstruction';
  observations: string | null;
  createdAt: Date;
}

// toYmd vit dans lib/dateOnly.ts : la version locale d'origine reprojetait
// la date en UTC et reculait d'un jour hors Greenwich.
const toYmd = (d: Date | null): string => (d ? ymd(d) : '');

function toMission(row: MissionRow): MissionTerrain {
  return {
    id: row.id,
    dateMission: toYmd(row.dateMission),
    localite: row.localite,
    region: row.region,
    latitude: row.latitude !== null ? Number(row.latitude) : null,
    longitude: row.longitude !== null ? Number(row.longitude) : null,
    projetRattache: row.projetRattache,
    constats: row.constats,
    recommandations: row.recommandations,
    nbOuvrages: row.nbOuvrages ?? 0,
    ouvragesParType: row.ouvragesParType ?? {},
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toOuvrage(row: OuvrageRow): OuvrageVisite {
  return {
    id: row.id,
    missionId: row.missionId,
    nomOuvrage: row.nomOuvrage,
    typeOuvrage: row.typeOuvrage,
    etatOuvrage: row.etatOuvrage,
    observations: row.observations,
    createdAt: row.createdAt.toISOString(),
  };
}

const SELECT_MISSION = `
  "id", "dateMission", "localite", "region", "latitude", "longitude",
  "projetRattache", "constats", "recommandations",
  "createdBy", "createdAt", "updatedAt"
`;

/**
 * Colonnes de mission + sous-totaux d'ouvrages visites.
 *
 * UN SEUL `LEFT JOIN LATERAL` plutot que deux sous-requetes correlees : le
 * total et la ventilation par type sortent du meme parcours de
 * `idxOuvragesMission`, et surtout ils ne peuvent pas diverger.
 *
 * `::INT` et non le bigint natif de COUNT/SUM : node-postgres rend les int8 en
 * chaine, ce qui donnerait un `nbOuvrages` string alors que le schema partage
 * attend un number.
 *
 * Le `FILTER (WHERE ... IS NOT NULL)` n'est pas cosmetique : `jsonb_object_agg`
 * leve une erreur des qu'une cle est NULL, et `typeOuvrage` est nullable.
 */
const JOIN_OUVRAGES = `
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(t."n"), 0)::INT AS "nbOuvrages",
      COALESCE(
        jsonb_object_agg(t."typeOuvrage", t."n") FILTER (WHERE t."typeOuvrage" IS NOT NULL),
        '{}'::jsonb
      ) AS "ouvragesParType"
    FROM (
      SELECT o."typeOuvrage", COUNT(*)::INT AS "n"
      FROM "ouvragesVisites" o
      WHERE o."missionId" = m."id"
      GROUP BY o."typeOuvrage"
    ) t
  ) ouv ON TRUE
`;

const SELECT_MISSION_AVEC_OUVRAGES = `
  m."id", m."dateMission", m."localite", m."region", m."latitude", m."longitude",
  m."projetRattache", m."constats", m."recommandations",
  m."createdBy", m."createdAt", m."updatedAt",
  ouv."nbOuvrages", ouv."ouvragesParType"
`;

export async function listMissions(opts: { annee?: number } = {}): Promise<MissionTerrain[]> {
  const params: number[] = [];
  let where = '';
  if (opts.annee !== undefined) {
    params.push(opts.annee);
    where = `WHERE EXTRACT(YEAR FROM m."dateMission") = $1`;
  }
  const rows = await queryAll<MissionRow>(
    `SELECT ${SELECT_MISSION_AVEC_OUVRAGES} FROM "missionsTerrain" m ${JOIN_OUVRAGES}
     ${where}
     ORDER BY m."dateMission" DESC`,
    params,
  );
  return rows.map(toMission);
}

export async function findMissionById(id: string): Promise<MissionTerrain | null> {
  const row = await queryOne<MissionRow>(
    `SELECT ${SELECT_MISSION_AVEC_OUVRAGES} FROM "missionsTerrain" m ${JOIN_OUVRAGES} WHERE m."id" = $1`,
    [id],
  );
  return row ? toMission(row) : null;
}

export async function listOuvragesByMission(missionId: string): Promise<OuvrageVisite[]> {
  const rows = await queryAll<OuvrageRow>(
    `SELECT "id", "missionId", "nomOuvrage", "typeOuvrage", "etatOuvrage", "observations", "createdAt"
     FROM "ouvragesVisites"
     WHERE "missionId" = $1
     ORDER BY "createdAt" ASC`,
    [missionId],
  );
  return rows.map(toOuvrage);
}

export async function createMission(
  input: CreateMissionTerrainInput,
  createdBy: string,
): Promise<MissionTerrain> {
  const row = await queryOne<MissionRow>(
    `INSERT INTO "missionsTerrain" (
       "dateMission", "localite", "region", "latitude", "longitude",
       "projetRattache", "constats", "recommandations", "createdBy"
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${SELECT_MISSION}`,
    [
      input.dateMission,
      input.localite,
      input.region,
      input.latitude,
      input.longitude,
      input.projetRattache,
      input.constats,
      input.recommandations,
      createdBy,
    ],
  );
  if (!row) throw new Error('Echec creation mission');
  // `nbOuvrages` retombe sur 0 via toMission : une mission qui vient d'etre
  // creee n'a par construction aucun ouvrage rattache.
  return toMission(row);
}

export async function updateMission(
  id: string,
  input: Partial<CreateMissionTerrainInput>,
): Promise<MissionTerrain> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, value: unknown): void => {
    params.push(value);
    sets.push(`"${col}" = $${params.length}`);
  };
  if (input.dateMission !== undefined) push('dateMission', input.dateMission);
  if (input.localite !== undefined) push('localite', input.localite);
  if (input.region !== undefined) push('region', input.region);
  if (input.latitude !== undefined) push('latitude', input.latitude);
  if (input.longitude !== undefined) push('longitude', input.longitude);
  if (input.projetRattache !== undefined) push('projetRattache', input.projetRattache);
  if (input.constats !== undefined) push('constats', input.constats);
  if (input.recommandations !== undefined) push('recommandations', input.recommandations);

  if (sets.length === 0) throw new Error('Aucun champ a mettre a jour');
  params.push(id);
  const row = await queryOne<{ id: string }>(
    `UPDATE "missionsTerrain" SET ${sets.join(', ')}
     WHERE "id" = $${params.length}
     RETURNING "id"`,
    params,
  );
  if (!row) throw new Error('Mission introuvable');
  // Relecture plutot que RETURNING : le sous-total d'ouvrages n'est pas
  // touche par l'UPDATE, et le renvoyer a 0 par defaut serait un mensonge.
  const mission = await findMissionById(row.id);
  if (!mission) throw new Error('Mission introuvable');
  return mission;
}

export async function deleteMission(id: string): Promise<void> {
  await query(`DELETE FROM "missionsTerrain" WHERE "id" = $1`, [id]);
}

export async function addOuvrage(
  missionId: string,
  input: { nomOuvrage: string; typeOuvrage?: string | null; etatOuvrage?: OuvrageRow['etatOuvrage']; observations?: string | null },
): Promise<OuvrageVisite> {
  const row = await queryOne<OuvrageRow>(
    `INSERT INTO "ouvragesVisites" ("missionId", "nomOuvrage", "typeOuvrage", "etatOuvrage", "observations")
     VALUES ($1, $2, $3, $4, $5)
     RETURNING "id", "missionId", "nomOuvrage", "typeOuvrage", "etatOuvrage", "observations", "createdAt"`,
    [missionId, input.nomOuvrage, input.typeOuvrage ?? null, input.etatOuvrage ?? 'fonctionnel', input.observations ?? null],
  );
  if (!row) throw new Error('Echec ajout ouvrage');
  return toOuvrage(row);
}

export async function deleteOuvrage(id: string): Promise<void> {
  await query(`DELETE FROM "ouvragesVisites" WHERE "id" = $1`, [id]);
}
