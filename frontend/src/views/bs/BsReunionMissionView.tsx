import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { ArrowLeft, Construction, MapPin, Plus, Save, Trash2, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  type CreateMissionTerrainInput,
  type CreateReunionTechniqueInput,
  type RegionSenegal,
  type SousSecteur,
} from '@mha-bs/shared';

import { FormField } from '../../components/ui/FormField.js';
import { Textarea } from '../../components/ui/Textarea.js';
import { useReferentiel } from '../../hooks/useReferentiel.js';
import { ApiClientError, api } from '../../lib/apiClient.js';
import { cn } from '../../lib/cn.js';
import { todayYmd } from '../../lib/formatDate.js';

type Mode = 'reunion' | 'mission';

interface ReunionFormValues {
  dateReunion: string;
  heureDebut: string;
  dureeEstimee: string;
  theme: string;
  lieu: string;
  sousSecteur: SousSecteur | '';
  copilLie: string;
  ordreDuJour: string;
  decisions: string;
  participantsRaw: string;
  visibleSg: boolean;
  inclusRapportHebdo: boolean;
}

interface MissionFormValues {
  dateMission: string;
  localite: string;
  region: RegionSenegal | '';
  latitude: string;
  longitude: string;
  projetRattache: string;
  constats: string;
  recommandations: string;
}

interface Ouvrage {
  nomOuvrage: string;
  typeOuvrage: string | null;
  etatOuvrage: 'fonctionnel' | 'maintenance' | 'horsService' | 'enConstruction';
}

const SENEGAL_CENTER: [number, number] = [14.7167, -17.4677];

// Icone leaflet custom (sinon icones par defaut cassees en bundle)
const PIN_ICON = L.divIcon({
  className: '',
  html: '<div style="background:#0284C7;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:11px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25)">●</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export function BsReunionMissionView() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('reunion');
  const [submitting, setSubmitting] = useState(false);
  const [ouvrages, setOuvrages] = useState<Ouvrage[]>([]);

  // Referentiels charges depuis l'API (gerables via /bs/config)
  const sousSecteursRef = useReferentiel('sousSecteur');
  const copilProjetRef = useReferentiel('copilProjet');
  const etatOuvrageRef = useReferentiel('etatOuvrage');
  const regionRef = useReferentiel('regionSenegal');
  const typeOuvrageRef = useReferentiel('typeOuvrage');

  const reunionForm = useForm<ReunionFormValues>({
    defaultValues: {
      dateReunion: todayYmd(),
      heureDebut: '10:00',
      dureeEstimee: '2h',
      theme: '',
      lieu: 'SG MHA · Salle Plénière',
      sousSecteur: '',
      copilLie: '—',
      ordreDuJour: '',
      decisions: '',
      participantsRaw: 'Cabinet MHA, DPGI, ONAS',
      visibleSg: true,
      inclusRapportHebdo: false,
    },
  });

  const missionForm = useForm<MissionFormValues>({
    defaultValues: {
      dateMission: todayYmd(),
      localite: '',
      region: 'Dakar',
      latitude: String(SENEGAL_CENTER[0]),
      longitude: String(SENEGAL_CENTER[1]),
      projetRattache: '',
      constats: '',
      recommandations: '',
    },
  });

  const submitReunion = async (v: ReunionFormValues): Promise<void> => {
    setSubmitting(true);
    try {
      const payload: CreateReunionTechniqueInput = {
        dateReunion: v.dateReunion,
        heureDebut: v.heureDebut || null,
        dureeEstimee: v.dureeEstimee || null,
        theme: v.theme,
        lieu: v.lieu || null,
        sousSecteur: v.sousSecteur || null,
        copilLie: v.copilLie === '—' ? null : v.copilLie || null,
        ordreDuJour: v.ordreDuJour || null,
        decisions: v.decisions || null,
        participants: v.participantsRaw.split(',').map((s) => s.trim()).filter(Boolean),
        visibleSg: v.visibleSg,
        inclusRapportHebdo: v.inclusRapportHebdo,
      };
      await api.post('/reunions', payload);
      toast.success('Réunion enregistrée');
      reunionForm.reset();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const submitMission = async (v: MissionFormValues): Promise<void> => {
    setSubmitting(true);
    try {
      const payload: CreateMissionTerrainInput = {
        dateMission: v.dateMission,
        localite: v.localite,
        region: v.region || null,
        latitude: v.latitude ? Number(v.latitude) : null,
        longitude: v.longitude ? Number(v.longitude) : null,
        projetRattache: v.projetRattache || null,
        constats: v.constats || null,
        recommandations: v.recommandations || null,
      };
      const created = await api.post<{ id: string }>('/missions', payload);
      // Ajout des ouvrages
      for (const o of ouvrages) {
        await api.post(`/missions/${created.id}/ouvrages`, o);
      }
      toast.success(`Mission enregistrée${ouvrages.length > 0 ? ` avec ${ouvrages.length} ouvrage(s)` : ''}`);
      missionForm.reset();
      setOuvrages([]);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Link
        to="/bs/liste"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted mb-3 hover:text-fg"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Retour
      </Link>

      <h1 className="text-2xl font-semibold text-fg leading-tight">Nouvelle réunion ou mission</h1>
      <p className="text-sm text-fg-muted mt-1 mb-5">
        Enregistrer une réunion technique du MHA ou une mission de suivi d'ouvrage sur le terrain
      </p>

      {/* Toggle mode */}
      <div className="inline-flex p-1 bg-muted rounded-lg mb-5">
        <button
          type="button"
          onClick={() => setMode('reunion')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2',
            mode === 'reunion' ? 'bg-surface text-fg shadow-sm' : 'text-fg-2 hover:text-fg',
          )}
        >
          <Users className="w-3.5 h-3.5" /> Réunion technique
        </button>
        <button
          type="button"
          onClick={() => setMode('mission')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2',
            mode === 'mission' ? 'bg-surface text-fg shadow-sm' : 'text-fg-2 hover:text-fg',
          )}
        >
          <MapPin className="w-3.5 h-3.5" /> Mission terrain
        </button>
      </div>

      {mode === 'reunion' && (
        <form
          onSubmit={(e) => void reunionForm.handleSubmit(submitReunion)(e)}
          className="card overflow-hidden grid grid-cols-1"
        >
          <fieldset className="p-5 border-b border-border">
            <legend className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-4">
              Contexte
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <FormField label="Date" required>
                <input
                  type="date"
                  className="input font-mono"
                  {...reunionForm.register('dateReunion', { required: true })}
                />
              </FormField>
              <FormField label="Heure">
                <input
                  type="time"
                  className="input font-mono"
                  {...reunionForm.register('heureDebut')}
                />
              </FormField>
              <FormField label="Durée estimée">
                <input type="text" className="input font-mono" {...reunionForm.register('dureeEstimee')} />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField
                label="Sous-secteur principal"
                help={
                  sousSecteursRef.items.length === 0 && !sousSecteursRef.isLoading
                    ? "Aucun sous-secteur défini. Ajoutez-en via Configuration."
                    : undefined
                }
              >
                <select className="select" {...reunionForm.register('sousSecteur')}>
                  <option value="">—</option>
                  {sousSecteursRef.items.map((s) => (
                    <option key={s.id} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Projet ou COPIL rattaché">
                <select className="select" {...reunionForm.register('copilLie')}>
                  <option value="—">—</option>
                  {copilProjetRef.items.map((c) => (
                    <option key={c.id} value={c.label}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </fieldset>

          <fieldset className="p-5 border-b border-border">
            <legend className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-4">
              Réunion
            </legend>
            <FormField label="Thème" required>
              <input
                type="text"
                className="input"
                placeholder="ex. Préparation hivernage 2026 · plan d'actions DPGI"
                {...reunionForm.register('theme', { required: 'Thème requis' })}
              />
            </FormField>
            <FormField label="Lieu" help="Saisie libre">
              <input type="text" className="input" {...reunionForm.register('lieu')} />
            </FormField>
            <FormField label="Participants" help="Séparer les noms par des virgules">
              <input
                type="text"
                className="input"
                {...reunionForm.register('participantsRaw')}
                placeholder="ex. Cabinet MHA, DPGI, ONAS, CPCSP"
              />
            </FormField>
            <FormField label="Ordre du jour">
              <Textarea rows={4} {...reunionForm.register('ordreDuJour')} placeholder="Point 1 :&#10;Point 2 :" />
            </FormField>
            <FormField label="Décisions / suites attendues">
              <Textarea rows={3} {...reunionForm.register('decisions')} />
            </FormField>
          </fieldset>

          <fieldset className="p-5 border-b border-border">
            <legend className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-4">
              Visibilité
            </legend>
            <label className="inline-flex items-center gap-2 text-sm mr-6">
              <input type="checkbox" className="accent-primary" {...reunionForm.register('visibleSg')} /> Visible au SG
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-primary" {...reunionForm.register('inclusRapportHebdo')} />{' '}
              Inclure dans le rapport hebdo
            </label>
          </fieldset>

          <div className="sticky bottom-0 bg-surface border-t border-border px-5 py-3.5 flex justify-end gap-2">
            <Link to="/bs/liste" className="btn btn-ghost">
              Annuler
            </Link>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <Save className="w-3.5 h-3.5" />
              {submitting ? 'Enregistrement…' : 'Enregistrer la réunion'}
            </button>
          </div>
        </form>
      )}

      {mode === 'mission' && (
        <form
          onSubmit={(e) => void missionForm.handleSubmit(submitMission)(e)}
          className="card overflow-hidden"
        >
          <fieldset className="p-5 border-b border-border">
            <legend className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-4">
              Contexte mission
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField label="Date" required>
                <input
                  type="date"
                  className="input font-mono"
                  {...missionForm.register('dateMission', { required: true })}
                />
              </FormField>
              <FormField label="Projet rattaché">
                <input
                  type="text"
                  className="input"
                  placeholder="ex. PROGEP II"
                  {...missionForm.register('projetRattache')}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField label="Localité" required>
                <input
                  type="text"
                  className="input"
                  placeholder="ex. Keur Massar — Tivaoune Peulh"
                  {...missionForm.register('localite', { required: 'Localité requise' })}
                />
              </FormField>
              <FormField label="Région">
                <select className="select" {...missionForm.register('region')}>
                  <option value="">—</option>
                  {regionRef.items.map((r) => (
                    <option key={r.id} value={r.label}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </fieldset>

          <fieldset className="p-5 border-b border-border">
            <legend className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-3">
              Géolocalisation
            </legend>
            <p className="text-xs text-fg-muted mb-2">Cliquez sur la carte pour positionner le site.</p>
            <Controller
              control={missionForm.control}
              name="latitude"
              render={({ field: latField }) => (
                <Controller
                  control={missionForm.control}
                  name="longitude"
                  render={({ field: lngField }) => (
                    <>
                      <div className="rounded border border-border overflow-hidden" style={{ height: 280 }}>
                        <MapContainer
                          center={[Number(latField.value) || SENEGAL_CENTER[0], Number(lngField.value) || SENEGAL_CENTER[1]]}
                          zoom={9}
                          scrollWheelZoom={false}
                          style={{ height: '100%', width: '100%' }}
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <ClickHandler
                            onPick={(lat, lng) => {
                              latField.onChange(String(lat.toFixed(6)));
                              lngField.onChange(String(lng.toFixed(6)));
                            }}
                          />
                          {Number(latField.value) && Number(lngField.value) && (
                            <Marker
                              position={[Number(latField.value), Number(lngField.value)]}
                              icon={PIN_ICON}
                            />
                          )}
                        </MapContainer>
                      </div>
                      <div className="flex gap-3 mt-2 text-xs font-mono text-fg-muted">
                        <span>
                          Latitude : <b className="text-fg-2">{latField.value || '—'}</b>
                        </span>
                        <span>
                          Longitude : <b className="text-fg-2">{lngField.value || '—'}</b>
                        </span>
                      </div>
                    </>
                  )}
                />
              )}
            />
          </fieldset>

          <fieldset className="p-5 border-b border-border">
            <legend className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-3">
              Ouvrages visités
            </legend>
            {ouvrages.length === 0 ? (
              <p className="text-sm text-fg-muted italic mb-3">Aucun ouvrage ajouté.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {ouvrages.map((o, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 border border-border rounded">
                    <Construction className="w-3.5 h-3.5 text-primary" />
                    <span className="flex-1 text-sm">{o.nomOuvrage}</span>
                    <span className="badge bg-muted text-fg-2 text-[11px]">{o.etatOuvrage}</span>
                    <button
                      type="button"
                      onClick={() => setOuvrages((arr) => arr.filter((_, idx) => idx !== i))}
                      className="text-fg-muted hover:text-danger"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <NewOuvrageRow
              onAdd={(o) => setOuvrages((arr) => [...arr, o])}
              etats={etatOuvrageRef.items.map((e) => ({ code: e.code, label: e.label }))}
              types={typeOuvrageRef.items.map((t) => ({ code: t.code, label: t.label }))}
            />
          </fieldset>

          <fieldset className="p-5 border-b border-border">
            <legend className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-3">
              Constats & recommandations
            </legend>
            <FormField label="Constats">
              <Textarea
                rows={4}
                {...missionForm.register('constats')}
                placeholder="Observations sur l'état des ouvrages, anomalies, actions urgentes…"
              />
            </FormField>
            <FormField label="Recommandations">
              <Textarea rows={3} {...missionForm.register('recommandations')} />
            </FormField>
          </fieldset>

          <div className="sticky bottom-0 bg-surface border-t border-border px-5 py-3.5 flex justify-end gap-2">
            <Link to="/bs/liste" className="btn btn-ghost">
              Annuler
            </Link>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <Save className="w-3.5 h-3.5" />
              {submitting ? 'Enregistrement…' : 'Enregistrer la mission'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function NewOuvrageRow({
  onAdd,
  etats,
  types,
}: {
  onAdd: (o: Ouvrage) => void;
  etats: { code: string; label: string }[];
  types: { code: string; label: string }[];
}) {
  const [nom, setNom] = useState('');
  const [typeOuvrage, setTypeOuvrage] = useState<string>('');
  const [etat, setEtat] = useState<Ouvrage['etatOuvrage']>('fonctionnel');

  const handleAdd = (): void => {
    const trimmed = nom.trim();
    if (!trimmed) return;
    onAdd({
      nomOuvrage: trimmed,
      typeOuvrage: typeOuvrage || null,
      etatOuvrage: etat,
    });
    setNom('');
    setTypeOuvrage('');
    setEtat('fonctionnel');
  };

  return (
    <div className="flex gap-2 items-center flex-wrap">
      <input
        type="text"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
          }
        }}
        placeholder="Nom de l'ouvrage (ex. Bassin de rétention Keur Massar)"
        className="input flex-1 min-w-[200px]"
      />
      <select
        value={typeOuvrage}
        onChange={(e) => setTypeOuvrage(e.target.value)}
        className="select w-44"
        aria-label="Type d'ouvrage"
      >
        <option value="">Type d'ouvrage…</option>
        {types.map((t) => (
          <option key={t.code} value={t.code}>
            {t.label}
          </option>
        ))}
      </select>
      <select
        value={etat}
        onChange={(e) => setEtat(e.target.value as Ouvrage['etatOuvrage'])}
        className="select w-44"
        aria-label="État de l'ouvrage"
      >
        {etats.length === 0 ? (
          <>
            <option value="fonctionnel">Fonctionnel</option>
            <option value="maintenance">Maintenance</option>
            <option value="horsService">Hors service</option>
            <option value="enConstruction">En construction</option>
          </>
        ) : (
          etats.map((e) => (
            <option key={e.code} value={e.code}>
              {e.label}
            </option>
          ))
        )}
      </select>
      <button type="button" onClick={handleAdd} className="btn btn-secondary btn-sm">
        <Plus className="w-3 h-3" /> Ajouter
      </button>
    </div>
  );
}

// Empêche le warning d'import non utilisé
export const _TRASH_ICON = Trash2;
