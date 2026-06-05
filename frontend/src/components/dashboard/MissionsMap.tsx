import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

import type { MissionTerrain } from '@mha-bs/shared';

import { formatShort } from '../../lib/formatDate.js';

/**
 * Bounding box SERRÉE sur le territoire continental du Sénégal.
 *
 * On borne l'ouest à -17.6 (côte de Dakar) au lieu de -17.8+ : sinon Leaflet,
 * pour faire tenir une bbox large dans un conteneur "paysage", ajoute beaucoup
 * d'océan Atlantique (et le Cap-Vert) à gauche et repousse le pays tout à
 * droite. Avec ces bornes resserrées, le Sénégal occupe le centre du cadre.
 */
const SENEGAL_BOUNDS: L.LatLngBoundsExpression = [
  [12.2, -17.6], // Sud-Ouest (côte / Casamance)
  [16.7, -11.4], // Nord-Est (vallée du fleuve / Kédougou)
];

/** Centre géographique du Sénégal — sert de point d'ancrage après fitBounds. */
const SENEGAL_CENTER: [number, number] = [14.5, -14.5];

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
        // bounds + zoomSnap=0 : fitBounds cadre EXACTEMENT le Sénégal (zoom
        // fractionnaire) au lieu d'arrondir le zoom vers le bas, ce qui
        // dézoomait jusqu'à montrer l'Atlantique + le Cap-Vert. Le pays est
        // ainsi centré dans le cadre.
        center={SENEGAL_CENTER}
        zoom={6.4}
        bounds={SENEGAL_BOUNDS}
        boundsOptions={{ padding: [4, 4] }}
        zoomSnap={0}
        zoomDelta={0.25}
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
