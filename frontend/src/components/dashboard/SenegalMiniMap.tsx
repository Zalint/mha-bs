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
 * Polygone simplifié du Sénégal (longitude, latitude) — environ 14 points,
 * dans le sens horaire en partant du Nord-Ouest. Précision suffisante pour
 * un dessin à ~200px, on n'a pas besoin du contour exact.
 */
const SENEGAL_POLYGON: ReadonlyArray<readonly [number, number]> = [
  [-16.5, 16.6], // NW Saint-Louis embouchure
  [-15.9, 16.6], // N — frontière Mauritanie (vallée fleuve Sénégal)
  [-14.6, 16.4], // N
  [-13.8, 16.0], // NE
  [-13.0, 14.9], // E — Bakel
  [-12.0, 14.7], // E
  [-11.5, 13.0], // SE — Kedougou
  [-12.0, 12.5], // S (Falémé)
  [-13.0, 12.7], // S
  [-14.5, 12.7], // S — Sédhiou
  [-16.0, 12.3], // SW — Casamance
  [-16.7, 12.5], // SW — Cap Skirring
  [-16.7, 13.5], // W — frontière Gambie sud
  // Encoche Gambie (allongée d'ouest en est) — on la dessine en montant un peu
  [-13.8, 13.5], // E entrée Gambie
  [-13.8, 13.8], // remonte
  [-16.7, 13.8], // W sortie Gambie
  // Ouest puis remonte Dakar
  [-16.8, 14.3], // W — Saloum
  [-17.1, 14.3], // W
  [-17.5, 14.7], // NW — Almadies
  [-16.9, 15.1], // N de Dakar
  [-16.5, 16.0], // remonte vers St-Louis
  [-16.5, 16.6], // boucle
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
