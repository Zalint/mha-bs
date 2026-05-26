import { AlertCircle, ChevronLeft, Mic, Plus, UserPlus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Spinner } from '../../components/ui/Spinner.js';
import { useApi } from '../../hooks/useApi.js';
import { useReferentiel } from '../../hooks/useReferentiel.js';
import { ApiClientError, api } from '../../lib/apiClient.js';

interface Depute {
  id: string;
  nomComplet: string;
  groupeParlementaire: string;
  region: string | null;
}

const NEW_DEPUTE_VALUE = '__new_depute__';

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function suggestReference(typeCode: string): string {
  const year = new Date().getFullYear();
  const prefix = typeCode === 'orale' ? 'QO' : typeCode === 'ecrite' ? 'QE' : typeCode === 'commission' ? 'CMS' : 'INT';
  return `${prefix}-${year}-`;
}

export function BsInterpellationNewView() {
  const navigate = useNavigate();
  const typeRef = useReferentiel('typeInterpellation');
  const groupeRef = useReferentiel('groupeParlementaire');
  const deputesQuery = useApi(() => api.get<{ items: Depute[] }>('/deputes'), []);

  // Form principal
  const [reference, setReference] = useState('');
  const [deputeId, setDeputeId] = useState<string>('');
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [typeInterpellation, setTypeInterpellation] = useState('orale');
  const [dateReception, setDateReception] = useState(todayYmd());
  const [echeanceReponse, setEcheanceReponse] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modale création député
  const [deputeModalOpen, setDeputeModalOpen] = useState(false);
  const [newDeputeNom, setNewDeputeNom] = useState('');
  const [newDeputeGroupe, setNewDeputeGroupe] = useState('');
  const [newDeputeSexe, setNewDeputeSexe] = useState<'M' | 'F' | ''>('');
  const [newDeputeRegion, setNewDeputeRegion] = useState('');
  const [creatingDepute, setCreatingDepute] = useState(false);

  // Suggère une référence par défaut au choix du type
  useEffect(() => {
    if (!reference) {
      setReference(suggestReference(typeInterpellation));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTypeChange = (next: string): void => {
    setTypeInterpellation(next);
    // Re-suggère le préfixe si on n'a pas saisi de référence ou si on a juste le préfixe
    const prevPrefix = suggestReference(typeInterpellation);
    if (!reference || reference === prevPrefix) {
      setReference(suggestReference(next));
    }
  };

  const handleDeputeChange = (value: string): void => {
    if (value === NEW_DEPUTE_VALUE) {
      setDeputeModalOpen(true);
    } else {
      setDeputeId(value);
    }
  };

  const closeDeputeModal = (): void => {
    if (creatingDepute) return;
    setDeputeModalOpen(false);
    setNewDeputeNom('');
    setNewDeputeGroupe('');
    setNewDeputeSexe('');
    setNewDeputeRegion('');
  };

  const handleCreateDepute = async (): Promise<void> => {
    const nom = newDeputeNom.trim();
    const groupe = newDeputeGroupe.trim();
    if (nom.length < 2 || groupe.length < 1) {
      toast.error('Nom complet et groupe parlementaire requis');
      return;
    }
    setCreatingDepute(true);
    try {
      const created = await api.post<Depute>('/deputes', {
        nomComplet: nom,
        groupeParlementaire: groupe,
        sexe: newDeputeSexe || null,
        region: newDeputeRegion.trim() || null,
      });
      toast.success(`Député "${nom}" créé`);
      await deputesQuery.refetch();
      setDeputeId(created.id);
      closeDeputeModal();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Échec création député');
    } finally {
      setCreatingDepute(false);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!reference.trim() || !deputeId || titre.trim().length < 3 || !typeInterpellation || !dateReception) {
      toast.error('Référence, député, titre, type et date de réception sont obligatoires');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/interpellations', {
        reference: reference.trim(),
        deputeId,
        titre: titre.trim(),
        description: description.trim() || null,
        typeInterpellation,
        dateReception,
        echeanceReponse: echeanceReponse || null,
      });
      toast.success('Interpellation enregistrée');
      navigate('/interpellations');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Échec de la création');
    } finally {
      setSubmitting(false);
    }
  };

  const deputes = useMemo(() => deputesQuery.data?.items ?? [], [deputesQuery.data]);

  if (deputesQuery.isLoading || typeRef.isLoading) {
    return <Spinner label="Chargement…" />;
  }

  return (
    <div className="max-w-3xl">
      <button
        type="button"
        onClick={() => navigate('/interpellations')}
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg mb-3"
      >
        <ChevronLeft className="w-4 h-4" /> Retour
      </button>

      <h1 className="text-2xl font-semibold text-fg leading-tight flex items-center gap-2.5">
        <Mic className="w-6 h-6 text-primary" strokeWidth={1.8} />
        Nouvelle interpellation parlementaire
      </h1>
      <p className="text-sm text-fg-muted mt-1 mb-6">
        Enregistre une question orale, écrite ou interpellation en commission posée par un député.
      </p>

      <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
        {/* Type + référence */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Type <span className="text-danger">*</span>
            </label>
            <select
              value={typeInterpellation}
              onChange={(e) => handleTypeChange(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 border border-border rounded text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {typeRef.items.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Référence <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={submitting}
              placeholder="QO-2026-001"
              className="w-full px-3 py-2 border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Député */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Député <span className="text-danger">*</span>
          </label>
          <select
            value={deputeId}
            onChange={(e) => handleDeputeChange(e.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2 border border-border rounded text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">— Sélectionner —</option>
            {deputes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nomComplet} ({d.groupeParlementaire})
              </option>
            ))}
            <option disabled>──────────</option>
            <option value={NEW_DEPUTE_VALUE}>+ Créer un nouveau député…</option>
          </select>
        </div>

        {/* Titre */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Titre <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            disabled={submitting}
            placeholder="Ex. : Situation de l'approvisionnement en eau de Saint-Louis"
            className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Description / question</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            rows={4}
            placeholder="Texte complet de la question…"
            className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Date de réception <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              value={dateReception}
              onChange={(e) => setDateReception(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Échéance de réponse</label>
            <input
              type="date"
              value={echeanceReponse}
              onChange={(e) => setEcheanceReponse(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate('/interpellations')}
            disabled={submitting}
          >
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            <Plus className="w-4 h-4" />
            {submitting ? 'Création…' : "Créer l'interpellation"}
          </button>
        </div>
      </div>

      {/* Modale création député */}
      {deputeModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={closeDeputeModal}
        >
          <div
            className="bg-surface rounded-xl border border-border w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Nouveau député</h2>
                  <p className="text-xs text-fg-muted mt-1">
                    Sera ajouté à la liste des députés. Tu pourras le réutiliser pour d&apos;autres
                    interpellations.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDeputeModal}
                disabled={creatingDepute}
                className="p-1 text-fg-muted hover:text-fg rounded hover:bg-muted"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Nom complet <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={newDeputeNom}
                  onChange={(e) => setNewDeputeNom(e.target.value)}
                  autoFocus
                  placeholder="Ex. : Mamadou Ndiaye"
                  className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Groupe parlementaire <span className="text-danger">*</span>
                </label>
                <select
                  value={newDeputeGroupe}
                  onChange={(e) => setNewDeputeGroupe(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">— Sélectionner —</option>
                  {groupeRef.items.map((g) => (
                    <option key={g.code} value={g.label}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Sexe</label>
                  <select
                    value={newDeputeSexe}
                    onChange={(e) => setNewDeputeSexe(e.target.value as 'M' | 'F' | '')}
                    className="w-full px-3 py-2 border border-border rounded text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">—</option>
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Région</label>
                  <input
                    type="text"
                    value={newDeputeRegion}
                    onChange={(e) => setNewDeputeRegion(e.target.value)}
                    placeholder="Optionnel"
                    className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="bg-primary-50 border-l-4 border-primary px-3 py-2 text-xs text-fg-2 rounded-r">
                <AlertCircle className="inline w-3 h-3 mr-1 text-primary" />
                Les groupes parlementaires sont gérables dans Configuration.
              </div>
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeDeputeModal}
                disabled={creatingDepute}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleCreateDepute()}
                disabled={creatingDepute || !newDeputeNom || !newDeputeGroupe}
              >
                {creatingDepute ? 'Création…' : 'Créer le député'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
