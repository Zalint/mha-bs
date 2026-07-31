import { Crosshair, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { LocaliteMission, RegionSenegal } from '@mha-bs/shared';

import { LocationPickerMap } from '../maps/LocationPickerMap.js';

/**
 * Éditeur de localités d'une mission : une ligne par localité, chacune avec ses
 * coordonnées propres. Composant AUTONOME — il gère lui-même le picker carte
 * (LocationPickerMap), de sorte que les deux formulaires (création dans
 * BsReunionMissionView, édition dans MissionsTerrainView) partagent exactement
 * le même comportement sans dupliquer la plomberie du picker.
 *
 * Coordonnées nullables : une localité sans GPS retombe, au RENDU de la carte,
 * sur le centroïde de la région de la mission (cf. REGION_CENTROIDS + pointLocalite).
 */
export function LocalitesField({
  localites,
  region,
  onChange,
}: {
  localites: LocaliteMission[];
  region: RegionSenegal | null;
  onChange: (next: LocaliteMission[]) => void;
}) {
  // Index de la localité dont on choisit les coordonnées (null = picker fermé).
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  const setNom = (i: number, nom: string): void =>
    onChange(localites.map((l, idx) => (idx === i ? { ...l, nom } : l)));
  const effacerCoords = (i: number): void =>
    onChange(localites.map((l, idx) => (idx === i ? { ...l, latitude: null, longitude: null } : l)));
  const ajouter = (): void => onChange([...localites, { nom: '', latitude: null, longitude: null }]);
  const retirer = (i: number): void => onChange(localites.filter((_, idx) => idx !== i));

  const cible = pickerIndex !== null ? localites[pickerIndex] : undefined;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="field-label mb-0">
          Localités <span className="text-danger">*</span>
        </span>
        <span className="text-[11px] text-fg-muted">Une ligne par localité visitée</span>
      </div>

      <div className="space-y-2">
        {localites.map((l, i) => {
          const aCoords = l.latitude !== null && l.longitude !== null;
          return (
            <div key={i} className="border border-border rounded-lg p-2.5 bg-surface2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-100 text-primary-700 font-mono text-[10px] font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <input
                  type="text"
                  value={l.nom}
                  onChange={(e) => setNom(i, e.target.value)}
                  className="input flex-1 min-w-0"
                  placeholder="ex. Dagana"
                />
                {localites.length > 1 && (
                  <button
                    type="button"
                    onClick={() => retirer(i)}
                    className="text-fg-muted hover:text-danger p-1 rounded flex-shrink-0"
                    aria-label={`Retirer la localité ${l.nom || i + 1}`}
                    title="Retirer cette localité"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 mt-1.5 pl-7">
                {aCoords ? (
                  <span className="font-mono text-[11px] text-fg-2">
                    {(l.latitude as number).toFixed(5)}, {(l.longitude as number).toFixed(5)}
                    <button
                      type="button"
                      onClick={() => effacerCoords(i)}
                      className="ml-2 text-fg-muted hover:text-danger"
                      title="Effacer les coordonnées (repli sur la région)"
                    >
                      ✕
                    </button>
                  </span>
                ) : (
                  <span className="text-[11px] text-fg-muted italic">
                    {region
                      ? `Sans GPS → centre de la région ${region}`
                      : 'Sans GPS ni région → non placée sur la carte'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setPickerIndex(i)}
                  className="btn btn-secondary btn-sm flex-shrink-0"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  {aCoords ? 'Modifier' : 'Choisir sur la carte'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" onClick={ajouter} className="btn btn-ghost btn-sm mt-2">
        <Plus className="w-3.5 h-3.5" /> Ajouter une localité
      </button>

      {pickerIndex !== null && cible && (
        <LocationPickerMap
          value={
            cible.latitude !== null && cible.longitude !== null
              ? { latitude: cible.latitude, longitude: cible.longitude }
              : null
          }
          title={`Localisation de ${cible.nom || 'la localité'}`}
          onCancel={() => setPickerIndex(null)}
          onConfirm={(coords) => {
            onChange(
              localites.map((l, idx) =>
                idx === pickerIndex
                  ? { ...l, latitude: coords?.latitude ?? null, longitude: coords?.longitude ?? null }
                  : l,
              ),
            );
            setPickerIndex(null);
          }}
        />
      )}
    </div>
  );
}
