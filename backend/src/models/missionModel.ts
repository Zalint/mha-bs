import type {
  CreateMissionTerrainInput,
  MissionTerrain,
  OuvrageVisite,
  RegionSenegal,
} from '@mha-bs/shared';

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

function toYmd(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

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

export async function listMissions(): Promise<MissionTerrain[]> {
  const rows = await queryAll<MissionRow>(
    `SELECT ${SELECT_MISSION} FROM "missionsTerrain"
     ORDER BY "dateMission" DESC`,
  );
  return rows.map(toMission);
}

export async function findMissionById(id: string): Promise<MissionTerrain | null> {
  const row = await queryOne<MissionRow>(
    `SELECT ${SELECT_MISSION} FROM "missionsTerrain" WHERE "id" = $1`,
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
  const row = await queryOne<MissionRow>(
    `UPDATE "missionsTerrain" SET ${sets.join(', ')}
     WHERE "id" = $${params.length}
     RETURNING ${SELECT_MISSION}`,
    params,
  );
  if (!row) throw new Error('Mission introuvable');
  return toMission(row);
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
