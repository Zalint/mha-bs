/**
 * DashboardMissionsMap — carte des missions pour le dashboard.
 *
 * Rend TOUJOURS la vraie carte Leaflet (tuiles OpenStreetMap), cadrée sur tout
 * le Sénégal via bounds (jamais tronquée). En mode PDF (forPrint), on désactive
 * juste les contrôles/interactions pour un rendu propre — mais la carte reste
 * la vraie carte OSM.
 *
 * Note : pour que les tuiles apparaissent dans le PDF (html2canvas), le parent
 * (DashboardView) attend que les tuiles soient chargées avant de lancer la
 * capture (cf. handleGeneratePdf).
 */

import type { MissionTerrain } from '@mha-bs/shared';

import { MissionsMap } from './MissionsMap.js';

interface Props {
  items: MissionTerrain[];
  height?: number;
  /** true pendant la génération PDF — désactive les contrôles Leaflet. */
  forPrint?: boolean;
}

export function DashboardMissionsMap({ items, height = 320, forPrint = false }: Props) {
  return <MissionsMap items={items} height={height} forPrint={forPrint} />;
}
