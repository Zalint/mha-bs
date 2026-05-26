import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

import type { MissionTerrain } from '@mha-bs/shared';

import { formatShort } from '../../lib/formatDate.js';

const SENEGAL_CENTER: [number, number] = [14.5, -14.5];

const PIN_ICON = L.divIcon({
  className: '',
  html: '<div style="background:#0284C7;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:10px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">●</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface Props {
  items: MissionTerrain[];
  height?: number;
  zoom?: number;
}

export function MissionsMap({ items, height = 320, zoom = 7 }: Props) {
  const positioned = items.filter((m) => m.latitude !== null && m.longitude !== null);
  return (
    <div style={{ height }} className="rounded-lg overflow-hidden border border-border">
      <MapContainer
        center={SENEGAL_CENTER}
        zoom={zoom}
        scrollWheelZoom={false}
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
