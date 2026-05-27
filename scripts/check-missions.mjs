/**
 * Verifie le contenu de la table missionsTerrain.
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('tsx/esm', pathToFileURL('./'));

const { queryAll } = await import('../backend/src/db/query.ts');
const rows = await queryAll(
  `SELECT "dateMission", "localite", "region", "projetRattache"
   FROM "missionsTerrain" ORDER BY "localite"`,
);
console.log(`Total missions en base : ${rows.length}`);
console.table(rows);
process.exit(0);
