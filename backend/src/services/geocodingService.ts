/**
 * Service de backfill géocodage pour les missions terrain existantes.
 *
 * Quand l'utilisateur a importé des missions AVANT que le gazetteer ne soit
 * branché dans l'import (commit feat(missions+interpellations): picker carte
 * + geocodage import), les lignes ont latitude/longitude/region NULL.
 *
 * Cette fonction parcourt ces lignes, applique le gazetteer Sénégal sur le
 * champ `localite` et complète ce qui peut l'être. Idempotente — on ne touche
 * que les colonnes NULL, jamais les valeurs déjà saisies par l'utilisateur.
 */

import { query, queryAll } from '../db/query.js';
import { geocode as geocodeLocalite } from '../lib/senegalGazetteer.js';

export interface BackfillSummary {
  /** Nombre de lignes parcourues. */
  total: number;
  /** Nombre de lignes mises à jour (au moins une colonne complétée). */
  updated: number;
  /** Nombre de lignes parcourues mais sans match dans le gazetteer. */
  skipped: number;
  /** Détail des localités sans match — utile pour enrichir le gazetteer. */
  unmatchedLocalites: string[];
}

interface MissionRow {
  id: string;
  localite: string;
  latitude: string | null;
  longitude: string | null;
  region: string | null;
}

/**
 * Backfill toutes les missions qui ont au moins une des colonnes
 * `latitude`/`longitude`/`region` à NULL.
 *
 * - `latitude` ou `longitude` NULL → on remplit les deux à partir du gazetteer
 *   (jamais un seul des deux, ça n'a pas de sens).
 * - `region` NULL → on la remplit depuis le gazetteer si match.
 *
 * Une mission peut donc être :
 *   - touchée sur (lat,lng) seulement, ou (region) seulement, ou les trois
 *   - skipped si aucun match dans le gazetteer pour son nom de localité
 */
export async function backfillMissionsGeocoding(): Promise<BackfillSummary> {
  // On ne sélectionne que les lignes qui ont au moins une colonne géo manquante
  const rows = await queryAll<MissionRow>(
    `SELECT "id", "localite", "latitude", "longitude", "region"
     FROM "missionsTerrain"
     WHERE "latitude" IS NULL OR "longitude" IS NULL OR "region" IS NULL`,
  );

  let updated = 0;
  const unmatched = new Set<string>();

  for (const r of rows) {
    const geo = geocodeLocalite(r.localite);
    if (!geo) {
      unmatched.add(r.localite);
      continue;
    }

    // Détermine ce qu'il faut écrire : on ne remplace JAMAIS une valeur non-null
    const sets: string[] = [];
    const params: unknown[] = [];

    const needLatLng = r.latitude === null || r.longitude === null;
    if (needLatLng) {
      params.push(geo.latitude);
      sets.push(`"latitude" = $${params.length}`);
      params.push(geo.longitude);
      sets.push(`"longitude" = $${params.length}`);
    }

    if (r.region === null) {
      params.push(geo.region);
      sets.push(`"region" = $${params.length}`);
    }

    if (sets.length === 0) continue; // rien à faire (ne devrait pas arriver vu le WHERE)

    params.push(r.id);
    await query(
      `UPDATE "missionsTerrain" SET ${sets.join(', ')} WHERE "id" = $${params.length}`,
      params,
    );
    updated++;
  }

  return {
    total: rows.length,
    updated,
    skipped: rows.length - updated,
    unmatchedLocalites: Array.from(unmatched).sort(),
  };
}
