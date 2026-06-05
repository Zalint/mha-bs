import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

import type { MissionTerrain } from '@mha-bs/shared';

import { formatShort } from '../../lib/formatDate.js';

/**
 * Bounding box du Sénégal entier (SW → NE) avec une petite marge.
 * En passant `bounds` à la MapContainer, Leaflet calcule automatiquement le
 * zoom pour faire tenir TOUT le pays dans le conteneur, quelle que soit sa
 * taille → jamais tronqué, et "dézoomé" pour voir l'ensemble du territoire.
 */
const SENEGAL_BOUNDS: L.LatLngBoundsExpression = [
  [12.0, -17.8], // Sud-Ouest (Casamance / Cap Skirring)
  [16.9, -11.2], // Nord-Est (vallée du fleuve / Kédougou)
];

const PIN_ICON = L.divIcon({
  className: '',
  html: '<div style="background:#0284C7;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:10px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">●</div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

interface Props {
  items: MissionTerrain[];
  height?: number;
  /** Désactive les contrôles + interactions (pour un rendu PDF propre). */
  forPrint?: boolean;
}

export function MissionsMap({ items, height = 320, forPrint = false }: Props) {
  const positioned = items.filter((m) => m.latitude !== null && m.longitude !== null);
  return (
    <div style={{ height }} className="rounded-lg overflow-hidden border border-border">
      <MapContainer
        // bounds fait tenir tout le Sénégal dans le conteneur → pas de troncature
        bounds={SENEGAL_BOUNDS}
        boundsOptions={{ padding: [6, 6] }}
        scrollWheelZoom={false}
        zoomControl={!forPrint}
        dragging={!forPrint}
        doubleClickZoom={!forPrint}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {positioned.map((m) => (
          <Marker
            key={m.id}
            position={[m.latitude as number, m.longitude as number]}
            icon={PIN_ICON}
          >
            <Popup>
              <div style={{ fontFamily: 'Fira Sans, system-ui, sans-serif' }}>
                <b style={{ color: '#0284C7' }}>{m.localite}</b>
                <br />
                <span style={{ color: '#64748B' }}>{m.projetRattache ?? '—'}</span>
                <br />
                <span style={{ fontFamily: 'Fira Mono, monospace', fontSize: 11 }}>
                  {m.dateMission ? formatShort(m.dateMission) : '—'} · {m.region ?? '—'}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
