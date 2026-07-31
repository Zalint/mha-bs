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

interface LocaliteJson {
  nom: string;
  latitude: number | null;
  longitude: number | null;
}

interface MissionRow {
  id: string;
  localites: LocaliteJson[];
  region: string | null;
}

/**
 * Complète, PAR LOCALITÉ, les coordonnées manquantes à partir du gazetteer, et
 * la région de la mission si elle est nulle. `localites` étant la source de
 * vérité, on géocode chaque entrée dont lat/lng est NULL, puis on réécrit le
 * tableau ET la projection scalaire (localite/latitude/longitude = première
 * localité). Idempotent : on ne touche jamais une coordonnée déjà saisie.
 */
export async function backfillMissionsGeocoding(): Promise<BackfillSummary> {
  const rows = await queryAll<MissionRow>(
    // Lignes ayant la region nulle, ou au moins une localité sans coordonnées.
    `SELECT "id", "localites", "region"
     FROM "missionsTerrain"
     WHERE "region" IS NULL
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements("localites") e
          WHERE e->>'latitude' IS NULL OR e->>'longitude' IS NULL
        )`,
  );

  let updated = 0;
  const unmatched = new Set<string>();

  for (const r of rows) {
    const localites = Array.isArray(r.localites) ? r.localites : [];
    let touche = false;

    const complet = localites.map((l) => {
      if (l.latitude !== null && l.longitude !== null) return l;
      const geo = geocodeLocalite(l.nom);
      if (!geo) {
        unmatched.add(l.nom);
        return l;
      }
      touche = true;
      return { nom: l.nom, latitude: geo.latitude, longitude: geo.longitude };
    });

    // Région : depuis le gazetteer de la 1re localité, si elle est nulle.
    let region = r.region;
    if (region === null && complet[0]) {
      const geo = geocodeLocalite(complet[0].nom);
      if (geo) {
        region = geo.region;
        touche = true;
      }
    }

    if (!touche) continue;

    const principale = complet[0];
    await query(
      `UPDATE "missionsTerrain"
         SET "localites" = $1::jsonb,
             "localite"  = $2,
             "latitude"  = $3,
             "longitude" = $4,
             "region"    = $5
       WHERE "id" = $6`,
      [
        JSON.stringify(complet),
        principale?.nom ?? '',
        principale?.latitude ?? null,
        principale?.longitude ?? null,
        region,
        r.id,
      ],
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
