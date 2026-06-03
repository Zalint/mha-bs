/**
 * SenegalMiniMap — mini-carte SVG statique du Sénégal pour les dashboards.
 *
 * POURQUOI un SVG static au lieu de Leaflet ?
 *   html2pdf.js / html2canvas (utilisé par le bouton "Générer PDF") ne capte
 *   PAS les tuiles Leaflet : (1) les tuiles sont chargées async via XHR et
 *   html2canvas ne les attend pas, (2) Leaflet pan via `transform: translate3d`
 *   que html2canvas rend mal. Résultat : la mini-carte sort vide ou tronquée.
 *
 *   À l'échelle d'un thumbnail dashboard (~176px), une SVG statique avec
 *   silhouette du Sénégal + points missions :
 *     - se rend PARFAITEMENT en PDF (c'est du vrai DOM SVG, pas du canvas)
 *     - reste lisible (peu de détail nécessaire)
 *     - aucune dépendance / tile externe
 *
 *   La page `/missions` garde la vraie carte Leaflet interactive.
 *
 * Données : silhouette du Sénégal simplifiée (~14 points), saisie à la main
 * depuis OpenStreetMap. Pas de fichier topojson, tout est dans le code.
 */

import type { MissionTerrain } from '@mha-bs/shared';

/**
 * Polygone détaillé du Sénégal (longitude, latitude) — ~36 points, dans le sens
 * horaire en partant du Nord-Ouest. Coords saisies à la main depuis les contours
 * OSM/Wikipedia. Encoche de la Gambie correctement formée (un slit horizontal).
 * Précision suffisante pour un dessin de 200 à 600px de large.
 */
const SENEGAL_POLYGON: ReadonlyArray<readonly [number, number]> = [
  // Côte nord & vallée du Sénégal (frontière Mauritanie)
  [-16.51, 16.07], // Saint-Louis embouchure
  [-16.43, 16.55], // Nord SL
  [-15.98, 16.50], // Rosso côté SN
  [-15.10, 16.45], // Dagana
  [-14.65, 16.43], // entre Dagana et Podor
  [-14.06, 16.16], // Podor
  [-13.32, 15.85], // Matam nord
  [-12.84, 15.65], // Ourossogui
  [-12.24, 14.95], // Bakel / Kidira
  // Frontière est avec Mali (la Falémé)
  [-12.05, 14.50],
  [-12.18, 13.78],
  [-11.46, 12.81], // Kedougou (point le plus à l'est)
  // Frontière sud avec Guinée
  [-12.05, 12.36],
  [-12.86, 12.45],
  [-13.65, 12.50],
  [-14.16, 12.61], // sud Tambacounda
  [-14.96, 12.43], // sud Kolda
  [-15.32, 12.62],
  [-15.65, 12.39], // sud Sédhiou
  [-16.10, 12.37], // Casamance
  // Côte atlantique sud (frontière Bissau)
  [-16.78, 12.36], // Cap Skirring
  [-16.77, 12.75],
  [-16.74, 13.05], // frontière sud Gambie (Diouloulou)
  // === Encoche Gambie (slit horizontal d'est en ouest puis retour) ===
  [-16.70, 13.13], // entrée encoche W
  [-15.55, 13.13], // limite Karang
  [-13.79, 13.21], // intérieur Gambie est
  [-13.79, 13.79], // remonte (border N-S de Niani-Maro)
  [-15.55, 13.79], // sortie Gambie côté E vers W
  [-16.68, 13.79], // sortie côté ouest
  // === Reprise côte atlantique au nord de la Gambie ===
  [-16.74, 13.85],
  [-16.85, 14.07], // Sokone area
  [-16.74, 14.27], // Joal
  [-16.96, 14.41], // Mbour
  [-17.03, 14.55], // Popenguine
  [-17.41, 14.59], // Almadies entrance
  [-17.54, 14.69], // Cap Vert / Pointe des Almadies
  [-17.46, 14.78], // Yoff
  [-17.20, 14.91], // Cap Mboro
  [-17.06, 15.06], // Kayar
  [-16.95, 15.50], // Lompoul
  [-16.55, 15.95], // Léona
  [-16.51, 16.07], // boucle → Saint-Louis
];

/** Bounding box Sénégal — large pour avoir de la marge. */
const BBOX = {
  minLng: -17.7,
  maxLng: -11.3,
  minLat: 12.2,
  maxLat: 16.8,
};

interface Props {
  items: MissionTerrain[];
  /** Hauteur en px (largeur calculée auto pour préserver l'aspect ratio). */
  height?: number;
}

export function SenegalMiniMap({ items, height = 176 }: Props) {
  const positioned = items.filter(
    (m): m is MissionTerrain & { latitude: number; longitude: number } =>
      m.latitude !== null && m.longitude !== null,
  );

  // Aspect ratio reel Senegal ~ 6.4° lng / 4.6° lat = 1.39 (correction longitude
  // par cos(lat moyen) pour eviter l'etirement, mais on reste sur un equirect
  // simple — suffisant a cette echelle).
  const aspect = (BBOX.maxLng - BBOX.minLng) / (BBOX.maxLat - BBOX.minLat);
  const width = Math.round(height * aspect);
  const padding = 8;

  const toX = (lng: number): number =>
    padding + ((lng - BBOX.minLng) / (BBOX.maxLng - BBOX.minLng)) * (width - 2 * padding);
  const toY = (lat: number): number =>
    padding + ((BBOX.maxLat - lat) / (BBOX.maxLat - BBOX.minLat)) * (height - 2 * padding);

  // Path du polygone Sénégal
  const path =
    SENEGAL_POLYGON.map(([lng, lat], i) => `${i === 0 ? 'M' : 'L'}${toX(lng)},${toY(lat)}`).join(
      ' ',
    ) + ' Z';

  // Dedup : aggregate les points coincidents. On utilise toFixed(3) (~110m de
  // precision) plutot que toFixed(2) (~1.1km) — sur la presqu'ile de Dakar les
  // communes voisines (Yeumbeul, Keur Massar, Pikine…) sont a moins d'1km
  // l'une de l'autre, on les ecrasait toutes en un seul point.
  const buckets = new Map<string, { lat: number; lng: number; count: number; label: string }>();
  for (const m of positioned) {
    const key = `${m.latitude.toFixed(3)},${m.longitude.toFixed(3)}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count++;
    } else {
      buckets.set(key, {
        lat: m.latitude,
        lng: m.longitude,
        count: 1,
        label: m.localite,
      });
    }
  }

  return (
    <div
      className="rounded-lg overflow-hidden border border-border bg-info-bg/30 flex items-center justify-center"
      style={{ height }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`Carte du Sénégal · ${positioned.length} missions situées`}
      >
        {/* Fond + silhouette Sénégal */}
        <path
          d={path}
          fill="#FFFFFF"
          stroke="#94A3B8"
          strokeWidth={0.8}
          strokeLinejoin="round"
        />

        {/* Marqueurs (groupés par coords arrondies) */}
        {Array.from(buckets.values()).map((b) => {
          const r = Math.min(8, 3 + Math.log2(b.count + 1) * 1.8);
          return (
            <g key={`${b.lat}-${b.lng}`} transform={`translate(${toX(b.lng)},${toY(b.lat)})`}>
              <circle
                r={r}
                fill="#0284C7"
                fillOpacity={0.85}
                stroke="#FFFFFF"
                strokeWidth={1.2}
              />
              {b.count > 1 && (
                <text
                  x={0}
                  y={r > 6 ? 2.5 : -r - 2}
                  textAnchor="middle"
                  fontSize={r > 6 ? '8' : '7'}
                  fill={r > 6 ? '#FFFFFF' : '#0F172A'}
                  fontFamily="Fira Mono, monospace"
                  fontWeight={600}
                >
                  {b.count}
                </text>
              )}
            </g>
          );
        })}

        {/* Label discret en bas — sert aussi de signature visuelle */}
        <text
          x={width - 6}
          y={height - 6}
          textAnchor="end"
          fontSize="8"
          fill="#94A3B8"
          fontFamily="Fira Mono, monospace"
        >
          Sénégal
        </text>
      </svg>
    </div>
  );
}
