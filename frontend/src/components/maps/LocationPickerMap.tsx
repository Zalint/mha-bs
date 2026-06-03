/**
 * LocationPickerMap — sélecteur de coordonnées sur une carte Leaflet.
 *
 * Modal plein-écran (overlay sombre + panneau blanc centré) avec une carte
 * cliquable. Un clic place ou déplace le marker. Tous les assets (CSS, tuiles
 * OpenStreetMap rendues à la volée par les serveurs OSM) sont chargés via les
 * dépendances npm (`leaflet` + `react-leaflet`) bundlées par Vite — pas de CDN
 * dans le HTML, pas de script externe.
 *
 * Props :
 *   - value     : coords initiales (ou null si jamais saisies)
 *   - onCancel  : ferme sans sauver
 *   - onConfirm : appelée avec les nouvelles coords (ou null si effacées)
 *   - title?    : titre affiché en header (default "Choisir la localisation")
 */

import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { MapPin, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';

const SENEGAL_CENTER: [number, number] = [14.5, -14.5];

/** Pin Leaflet custom (pas de fichier image — divIcon HTML pur). */
const PIN_ICON = L.divIcon({
  className: '',
  html: '<div style="background:#0284C7;color:#fff;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35)"><div style="transform:rotate(45deg);font-weight:700;font-size:14px;font-family:Fira Mono, monospace">●</div></div>',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

interface Coords {
  latitude: number;
  longitude: number;
}

interface LocationPickerMapProps {
  value: Coords | null;
  onCancel: () => void;
  onConfirm: (coords: Coords | null) => void;
  title?: string;
}

/**
 * Hook interne — branche un handler de clic sur la MapContainer parente via
 * useMapEvents. Doit être rendu À L'INTÉRIEUR de la MapContainer (limitation
 * react-leaflet : le contexte de la carte est fourni par MapContainer).
 */
function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationPickerMap({
  value,
  onCancel,
  onConfirm,
  title = 'Choisir la localisation',
}: LocationPickerMapProps) {
  // État local — on ne touche au parent qu'à la confirmation, pour permettre
  // l'annulation propre (revert).
  const [coords, setCoords] = useState<Coords | null>(value);

  const handlePick = (latitude: number, longitude: number): void => {
    setCoords({ latitude, longitude });
  };

  const handleClear = (): void => setCoords(null);
  const handleConfirm = (): void => onConfirm(coords);

  // Format affichage — 6 décimales = précision ~0.1m, largement suffisant.
  const latLabel = coords ? coords.latitude.toFixed(6) : '—';
  const lngLabel = coords ? coords.longitude.toFixed(6) : '—';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-xl shadow-2xl border border-border w-full max-w-4xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface2">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <h2 className="text-md font-semibold">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-fg-muted hover:text-fg p-1 rounded"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Indication coords + actions */}
        <div className="px-5 py-3 border-b border-border bg-surface flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex gap-3 items-center font-mono text-xs">
            <span className="text-fg-muted">Latitude :</span>
            <span className="font-semibold tabular-nums">{latLabel}</span>
            <span className="text-fg-muted">Longitude :</span>
            <span className="font-semibold tabular-nums">{lngLabel}</span>
          </div>
          {coords && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-danger hover:underline flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Effacer le pin
            </button>
          )}
        </div>

        {/* Carte */}
        <div className="flex-1 min-h-[400px]" style={{ position: 'relative' }}>
          <MapContainer
            center={coords ? [coords.latitude, coords.longitude] : SENEGAL_CENTER}
            zoom={coords ? 11 : 7}
            scrollWheelZoom
            style={{ height: '100%', width: '100%', minHeight: 400 }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onPick={handlePick} />
            {coords && (
              <Marker position={[coords.latitude, coords.longitude]} icon={PIN_ICON} />
            )}
          </MapContainer>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-surface2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-fg-muted italic">
            Cliquez sur la carte pour placer / déplacer le pin.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Annuler
            </button>
            <button type="button" className="btn btn-primary" onClick={handleConfirm}>
              <MapPin className="w-3.5 h-3.5" />
              Confirmer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
