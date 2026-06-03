import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import {
  CalendarClock,
  ChevronRight,
  Construction,
  Crosshair,
  Globe,
  Layers,
  MapPin,
  Maximize,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type { MissionTerrain } from '@mha-bs/shared';
import { REGIONS_SENEGAL } from '@mha-bs/shared';

import { LocationPickerMap } from '../components/maps/LocationPickerMap.js';
import { KpiCard } from '../components/ui/KpiCard.js';
import { Spinner } from '../components/ui/Spinner.js';
import { useApi } from '../hooks/useApi.js';
import { ApiClientError, api } from '../lib/apiClient.js';
import { cn } from '../lib/cn.js';
import { formatShort } from '../lib/formatDate.js';
import { useAuthStore } from '../stores/authStore.js';

const SENEGAL_BOUNDS: [number, number] = [14.5, -14.5];
const PIN_ICON = L.divIcon({
  className: '',
  html: '<div style="background:#0284C7;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:11px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);font-family:Fira Mono, monospace">●</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

/**
 * Brouillon de mission en cours d'édition. On extrait les champs éditables et
 * on garde l'id en clé pour la requête PUT. Tous les champs nullable côté DB
 * sont en string vide ici pour simplifier le binding form.
 */
interface MissionDraft {
  id: string;
  dateMission: string;
  localite: string;
  region: string; // '' = null
  latitude: number | null;
  longitude: number | null;
  projetRattache: string; // '' = null
  constats: string; // '' = null
  recommandations: string; // '' = null
}

function missionToDraft(m: MissionTerrain): MissionDraft {
  return {
    id: m.id,
    dateMission: m.dateMission,
    localite: m.localite,
    region: m.region ?? '',
    latitude: m.latitude,
    longitude: m.longitude,
    projetRattache: m.projetRattache ?? '',
    constats: m.constats ?? '',
    recommandations: m.recommandations ?? '',
  };
}

export function MissionsTerrainView() {
  const navigate = useNavigate();
  const userRole = useAuthStore((s) => s.user?.role);
  const canEdit = userRole === 'admin' || userRole === 'bs';
  const isAdmin = userRole === 'admin';

  const query = useApi(() => api.get<{ items: MissionTerrain[] }>('/missions'), []);
  const items = query.data?.items ?? [];

  const mapRef = useRef<L.Map | null>(null);

  // Édition : draft de mission + modal picker carte
  const [editDraft, setEditDraft] = useState<MissionDraft | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const startEdit = (m: MissionTerrain): void => {
    setEditDraft(missionToDraft(m));
  };
  const cancelEdit = (): void => {
    setEditDraft(null);
    setShowPicker(false);
  };
  const saveEdit = async (): Promise<void> => {
    if (!editDraft) return;
    setSaving(true);
    try {
      await api.put(`/missions/${editDraft.id}`, {
        dateMission: editDraft.dateMission,
        localite: editDraft.localite,
        region: editDraft.region || null,
        latitude: editDraft.latitude,
        longitude: editDraft.longitude,
        projetRattache: editDraft.projetRattache || null,
        constats: editDraft.constats || null,
        recommandations: editDraft.recommandations || null,
      });
      toast.success('Mission mise à jour');
      setEditDraft(null);
      query.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur de mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const deleteMission = async (m: MissionTerrain): Promise<void> => {
    if (!window.confirm(`Supprimer la mission de ${m.localite} (${formatShort(m.dateMission)}) ?`))
      return;
    try {
      await api.delete(`/missions/${m.id}`);
      toast.success('Mission supprimée');
      query.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur de suppression');
    }
  };

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
                <div
                  key={m.id}
                  className={cn(
                    'grid grid-cols-[36px_1fr_auto] gap-3 px-4 py-3 border-b border-border',
                    'last:border-0 hover:bg-muted items-center',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (mapRef.current && m.latitude !== null && m.longitude !== null) {
                        mapRef.current.setView([m.latitude, m.longitude], 13, { animate: true });
                      }
                    }}
                    className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-mono font-semibold text-[11px] hover:opacity-80"
                    aria-label="Centrer sur la carte"
                    title={
                      m.latitude !== null
                        ? 'Centrer sur la carte'
                        : 'Coordonnées non renseignées'
                    }
                  >
                    {m.localite.slice(0, 2).toUpperCase()}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (mapRef.current && m.latitude !== null && m.longitude !== null) {
                        mapRef.current.setView([m.latitude, m.longitude], 13, { animate: true });
                      }
                    }}
                    className="text-left min-w-0"
                  >
                    <div className="text-sm font-semibold truncate">{m.localite}</div>
                    <div className="text-[11.5px] text-fg-muted font-mono">
                      {m.projetRattache ?? '—'} · {m.region ?? '—'} ·{' '}
                      {m.dateMission ? formatShort(m.dateMission) : '—'}
                    </div>
                    {m.constats && (
                      <div className="text-xs text-fg-2 mt-1 line-clamp-1">{m.constats}</div>
                    )}
                  </button>
                  {canEdit ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(m)}
                        className="text-fg-muted hover:text-primary p-1.5 rounded"
                        aria-label="Éditer"
                        title="Éditer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => void deleteMission(m)}
                          className="text-fg-muted hover:text-danger p-1.5 rounded"
                          aria-label="Supprimer"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-fg-muted" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {items.length === 0 && (
        <p className="mt-3 text-xs text-fg-muted italic">
          Aucune mission terrain en base. Crée une nouvelle mission via le bouton ci-dessus.
        </p>
      )}

      {/* Modal d'édition */}
      {editDraft && (
        <MissionEditModal
          draft={editDraft}
          onChange={setEditDraft}
          onCancel={cancelEdit}
          onSave={() => void saveEdit()}
          onOpenPicker={() => setShowPicker(true)}
          saving={saving}
        />
      )}

      {/* Modal picker carte (au-dessus du modal d'édition) */}
      {showPicker && editDraft && (
        <LocationPickerMap
          value={
            editDraft.latitude !== null && editDraft.longitude !== null
              ? { latitude: editDraft.latitude, longitude: editDraft.longitude }
              : null
          }
          title={`Localisation de ${editDraft.localite || 'la mission'}`}
          onCancel={() => setShowPicker(false)}
          onConfirm={(coords) => {
            setEditDraft({
              ...editDraft,
              latitude: coords?.latitude ?? null,
              longitude: coords?.longitude ?? null,
            });
            setShowPicker(false);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal d'édition d'une mission — formulaire + bouton "Choisir sur la carte"
// ---------------------------------------------------------------------------

interface MissionEditModalProps {
  draft: MissionDraft;
  onChange: (next: MissionDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  onOpenPicker: () => void;
  saving: boolean;
}

function MissionEditModal({
  draft,
  onChange,
  onCancel,
  onSave,
  onOpenPicker,
  saving,
}: MissionEditModalProps) {
  const set = <K extends keyof MissionDraft>(k: K, v: MissionDraft[K]): void => {
    onChange({ ...draft, [k]: v });
  };

  return (
    <div
      // z-[1000] — au-dessus des panes/controls Leaflet (qui montent jusqu'à 800).
      // Le picker carte (autre modal) doit etre encore au-dessus (cf. z-[1100]).
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-xl shadow-2xl border border-border w-full max-w-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface2">
          <h2 className="text-md font-semibold flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />
            Éditer la mission
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-fg-muted hover:text-fg p-1 rounded"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date de mission" required>
              <input
                type="date"
                value={draft.dateMission}
                onChange={(e) => set('dateMission', e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Région">
              <select
                value={draft.region}
                onChange={(e) => set('region', e.target.value)}
                className="input"
              >
                <option value="">— Aucune —</option>
                {REGIONS_SENEGAL.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Localité" required>
            <input
              type="text"
              value={draft.localite}
              onChange={(e) => set('localite', e.target.value)}
              className="input"
              placeholder="ex. Touba, Tivaouane Peulh…"
            />
          </Field>

          <Field label="Projet rattaché">
            <input
              type="text"
              value={draft.projetRattache}
              onChange={(e) => set('projetRattache', e.target.value)}
              className="input"
              placeholder="ex. PROGEP II, ONAS, PISEA…"
            />
          </Field>

          {/* Localisation : coords + bouton carte */}
          <div className="border border-border rounded-lg p-3 bg-surface2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">
                Coordonnées GPS
              </span>
              <button
                type="button"
                onClick={onOpenPicker}
                className="btn btn-secondary btn-sm"
              >
                <Crosshair className="w-3.5 h-3.5" />
                Choisir sur la carte
              </button>
            </div>
            {draft.latitude !== null && draft.longitude !== null ? (
              <div className="font-mono text-xs grid grid-cols-2 gap-3">
                <div>
                  <span className="text-fg-muted">Latitude :</span>{' '}
                  <span className="font-semibold">{draft.latitude.toFixed(6)}</span>
                </div>
                <div>
                  <span className="text-fg-muted">Longitude :</span>{' '}
                  <span className="font-semibold">{draft.longitude.toFixed(6)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-fg-muted italic">
                Aucune coordonnée saisie. Cliquez sur « Choisir sur la carte » pour
                pointer la localisation.
              </p>
            )}
          </div>

          <Field label="Constats">
            <textarea
              value={draft.constats}
              onChange={(e) => set('constats', e.target.value)}
              className="input min-h-[80px]"
              placeholder="Observations sur le terrain, état des ouvrages…"
            />
          </Field>

          <Field label="Recommandations">
            <textarea
              value={draft.recommandations}
              onChange={(e) => set('recommandations', e.target.value)}
              className="input min-h-[80px]"
              placeholder="Actions à mener suite à la visite…"
            />
          </Field>
        </div>

        <div className="px-5 py-3 border-t border-border bg-surface2 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSave}
            disabled={saving || !draft.dateMission || !draft.localite}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ label, required, children }: FieldProps) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-fg-muted mb-1">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
    </label>
  );
}
