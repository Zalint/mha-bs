import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { CalendarClock, ChevronRight, Construction, Globe, Layers, MapPin, Maximize, Plus } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';

import type { MissionTerrain } from '@mha-bs/shared';

import { KpiCard } from '../components/ui/KpiCard.js';
import { Spinner } from '../components/ui/Spinner.js';
import { useApi } from '../hooks/useApi.js';
import { api } from '../lib/apiClient.js';
import { cn } from '../lib/cn.js';
import { formatShort } from '../lib/formatDate.js';

const SENEGAL_BOUNDS: [number, number] = [14.5, -14.5];
const PIN_ICON = L.divIcon({
  className: '',
  html: '<div style="background:#0284C7;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:11px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);font-family:Fira Mono, monospace">●</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Donnees de demo : sites pre-saisis dans les maquettes pour combler quand la table est encore vide
const DEMO_SITES: MissionTerrain[] = [
  { id: 'demo-1', dateMission: '2026-05-11', localite: 'Keur Massar', region: 'Dakar', latitude: 14.7799, longitude: -17.3344, projetRattache: 'PROGEP II', constats: 'Suivi des bassins versants de Mbao. Avancement satisfaisant.', recommandations: 'Curage à finaliser avant juin.', createdBy: null, createdAt: '', updatedAt: '' },
  { id: 'demo-2', dateMission: '2026-05-11', localite: 'Tivaouane Peulh', region: 'Dakar', latitude: 14.8167, longitude: -17.2667, projetRattache: 'PISEA / SFI', constats: "Station d'épuration eaux usées (PPP).", recommandations: 'Études techniques en cours.', createdBy: null, createdAt: '', updatedAt: '' },
  { id: 'demo-3', dateMission: '2026-05-11', localite: 'Thiaroye Sur Mer', region: 'Dakar', latitude: 14.7461, longitude: -17.3192, projetRattache: 'ONAS', constats: "Réseau d'assainissement.", recommandations: 'Travaux à 68% d\'avancement.', createdBy: null, createdAt: '', updatedAt: '' },
  { id: 'demo-4', dateMission: '2026-05-11', localite: 'APIX Mbao', region: 'Dakar', latitude: 14.7333, longitude: -17.3667, projetRattache: 'DPGI', constats: 'Ouvrages anti-inondations.', recommandations: 'Maintenance avant hivernage.', createdBy: null, createdAt: '', updatedAt: '' },
];

export function MissionsTerrainView() {
  const navigate = useNavigate();
  const query = useApi(() => api.get<{ items: MissionTerrain[] }>('/missions'), []);
  const realItems = query.data?.items ?? [];
  // Si rien en base on affiche au moins les sites de demo pour donner de la matiere
  const items = realItems.length > 0 ? realItems : DEMO_SITES;

  const mapRef = useRef<L.Map | null>(null);

  const regions = useMemo(() => {
    return new Set(items.map((i) => i.region).filter(Boolean));
  }, [items]);

  if (query.isLoading) return <Spinner label="Chargement des missions terrain…" />;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-3">
        <div>
          <h1 className="text-2xl font-semibold text-fg leading-tight">Suivi missions terrain</h1>
          <p className="text-sm text-fg-muted mt-1">
            Sites d'ouvrages visités par le MHA · cartographie nationale et observations
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/bs/reunion')}>
          <Plus className="w-3.5 h-3.5" /> Nouvelle mission
        </button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 mb-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Missions effectuées" value={items.length} delta="depuis le début" icon={MapPin} />
        <KpiCard
          label="Sites visités"
          value={items.length}
          delta="ouvrages d'envergure"
          icon={Construction}
        />
        <KpiCard
          label="Régions couvertes"
          value={regions.size}
          delta={Array.from(regions).slice(0, 3).join(' · ')}
          icon={Globe}
        />
        <KpiCard
          label="Prochaine mission"
          value="21-05-2026"
          delta="PDBH · Baie de Hann"
          icon={CalendarClock}
        />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-[1.6fr_1fr]">
        {/* Carte */}
        <div className="card overflow-hidden">
          <div className="card-header">
            <div>
              <h2 className="text-md font-semibold">Carte nationale des missions</h2>
              <p className="text-xs text-fg-muted mt-0.5">Cliquez sur un marqueur pour voir le détail.</p>
            </div>
            <div className="ml-auto flex gap-2">
              <button className="btn btn-ghost btn-sm">
                <Layers className="w-3 h-3" /> Couches
              </button>
              <button className="btn btn-ghost btn-sm">
                <Maximize className="w-3 h-3" /> Plein écran
              </button>
            </div>
          </div>
          <div style={{ height: 520 }}>
            <MapContainer
              center={SENEGAL_BOUNDS}
              zoom={7}
              scrollWheelZoom
              style={{ height: '100%', width: '100%' }}
              ref={(map) => {
                if (map) mapRef.current = map;
              }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {items
                .filter((m) => m.latitude !== null && m.longitude !== null)
                .map((m) => (
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
                        {m.constats && (
                          <>
                            <br />
                            {m.constats.slice(0, 110)}
                          </>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          </div>
        </div>

        {/* Liste */}
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="text-md font-semibold">Sites visités</h2>
            <span className="ml-auto text-sm text-fg-muted">{items.length} site(s)</span>
          </div>
          <div className="max-h-[520px] overflow-auto">
            {items.length === 0 ? (
              <p className="text-sm text-fg-muted text-center py-10">Aucune mission enregistrée.</p>
            ) : (
              items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    if (mapRef.current && m.latitude !== null && m.longitude !== null) {
                      mapRef.current.setView([m.latitude, m.longitude], 13, { animate: true });
                    }
                  }}
                  className={cn(
                    'w-full text-left grid grid-cols-[36px_1fr_auto] gap-3 px-4 py-3 border-b border-border',
                    'last:border-0 hover:bg-muted cursor-pointer items-center',
                  )}
                >
                  <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-mono font-semibold text-[11px]">
                    {m.localite.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{m.localite}</div>
                    <div className="text-[11.5px] text-fg-muted font-mono">
                      {m.projetRattache ?? '—'} · {m.region ?? '—'} ·{' '}
                      {m.dateMission ? formatShort(m.dateMission) : '—'}
                    </div>
                    {m.constats && (
                      <div className="text-xs text-fg-2 mt-1 line-clamp-1">{m.constats}</div>
                    )}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-fg-muted" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {realItems.length === 0 && (
        <p className="mt-3 text-xs text-fg-muted italic">
          Affichage de 4 sites de démonstration (la table missionsTerrain est encore vide). Crée une
          nouvelle mission via le bouton ci-dessus pour la voir apparaître ici.
        </p>
      )}
    </div>
  );
}
