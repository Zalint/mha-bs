/**
 * DashboardMissionsMap — wrapper qui choisit la bonne carte selon le contexte :
 *   - À l'écran     : MissionsMap (Leaflet, interactive — zoom, pan, popups)
 *   - En PDF (html2pdf/html2canvas ne sait pas capturer Leaflet) :
 *                     SenegalMiniMap (SVG statique, rendu identique a l'ecran
 *                     et en PDF)
 *
 * Le parent (DashboardView) passe `forPrint` à true juste avant la generation
 * PDF, ce qui declenche le swap. Les deux composants partagent la meme API
 * (items + height) pour permettre un drop-in remplacement.
 */

import type { MissionTerrain } from '@mha-bs/shared';

import { MissionsMap } from './MissionsMap.js';
import { SenegalMiniMap } from './SenegalMiniMap.js';

interface Props {
  items: MissionTerrain[];
  height?: number;
  /** Force le rendu SVG statique (typique : juste avant generation PDF). */
  forPrint?: boolean;
  /** Zoom initial Leaflet (ignore quand forPrint=true). */
  zoom?: number;
}

export function DashboardMissionsMap({ items, height = 320, forPrint = false, zoom = 7 }: Props) {
  if (forPrint) {
    return <SenegalMiniMap items={items} height={height} />;
  }
  return <MissionsMap items={items} height={height} zoom={zoom} />;
}
