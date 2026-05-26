import { AlertCircle, ChevronLeft, FolderPlus, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type { RecommandationMatrice } from '@mha-bs/shared';

import { Spinner } from '../../components/ui/Spinner.js';
import { useReferentiel } from '../../hooks/useReferentiel.js';
import { ApiClientError, api } from '../../lib/apiClient.js';

const NEW_MATRICE_VALUE = '__new_matrice__';

/**
 * Convertit un libellé en code camelCase compatible avec le schéma
 * referentiels (alphanumérique + _ + -). Ex : "COPIL Foo Bar" → "copilFooBar".
 */
function slugifyMatriceCode(label: string): string {
  const cleaned = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .toLowerCase();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/);
  return parts
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('');
}

export function BsRecommandationNewView() {
  const navigate = useNavigate();
  const matrices = useReferentiel('typeMatrice');

  // État formulaire principal
  const [selectedMatrice, setSelectedMatrice] = useState<string>('');
  const [texte, setTexte] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // État création de matrice (2 étapes : confirmation, puis saisie)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [creatingMatrice, setCreatingMatrice] = useState(false);
  const [newMatriceStep, setNewMatriceStep] = useState<'confirm' | 'form'>('confirm');
  const [newMatriceLabel, setNewMatriceLabel] = useState('');
  const [newMatriceCode, setNewMatriceCode] = useState('');
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);

  useEffect(() => {
    if (!codeManuallyEdited) {
      setNewMatriceCode(slugifyMatriceCode(newMatriceLabel));
    }
  }, [newMatriceLabel, codeManuallyEdited]);

  const handleMatriceChange = (value: string): void => {
    if (value === NEW_MATRICE_VALUE) {
      setConfirmOpen(true);
      setNewMatriceStep('confirm');
    } else {
      setSelectedMatrice(value);
    }
  };

  const closeNewMatriceModal = (): void => {
    if (creatingMatrice) return;
    setConfirmOpen(false);
    setNewMatriceLabel('');
    setNewMatriceCode('');
    setCodeManuallyEdited(false);
    setNewMatriceStep('confirm');
  };

  const handleCreateMatrice = async (): Promise<void> => {
    const label = newMatriceLabel.trim();
    const code = newMatriceCode.trim();
    if (label.length < 2 || code.length < 2) {
      toast.error('Libellé et code requis (2 caractères minimum)');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
      toast.error('Code invalide : lettres, chiffres, - et _ uniquement');
      return;
    }
    setCreatingMatrice(true);
    try {
      await api.post('/referentiels', {
        codeType: 'typeMatrice',
        code,
        label,
        ordreAffichage: 999, // En bas par défaut
      });
      toast.success(`Matrice "${label}" créée`);
      await matrices.refetch();
      setSelectedMatrice(code);
      closeNewMatriceModal();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403) {
        toast.error("Création de matrice réservée aux admins. Demande à un administrateur.");
      } else if (err instanceof ApiClientError) {
        toast.error(err.message);
      } else {
        toast.error('Échec de la création');
      }
    } finally {
      setCreatingMatrice(false);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    const text = texte.trim();
    if (!selectedMatrice) {
      toast.error('Choisis une matrice');
      return;
    }
    if (text.length < 3) {
      toast.error('Texte trop court (3 caractères minimum)');
      return;
    }
    setSubmitting(true);
    try {
      await api.post<RecommandationMatrice>('/matrices', {
        typeMatrice: selectedMatrice,
        texteRecommandation: text,
      });
      toast.success('Recommandation créée');
      navigate('/bs/matrice');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Échec de la création');
    } finally {
      setSubmitting(false);
    }
  };

  if (matrices.isLoading) return <Spinner label="Chargement des matrices…" />;

  return (
    <div className="max-w-2xl">
      <button
        type="button"
        onClick={() => navigate('/bs/liste')}
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg mb-3"
      >
        <ChevronLeft className="w-4 h-4" /> Retour
      </button>

      <h1 className="text-2xl font-semibold text-fg leading-tight">Nouvelle recommandation</h1>
      <p className="text-sm text-fg-muted mt-1 mb-6">
        Ajoute une recommandation à une matrice (COPIL, Réforme, CNGI…). Numéro d&apos;ordre attribué
        automatiquement.
      </p>

      <div className="bg-surface border border-border rounded-lg p-5 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Matrice <span className="text-danger">*</span>
          </label>
          <select
            value={selectedMatrice}
            onChange={(e) => handleMatriceChange(e.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2 border border-border rounded text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="">— Sélectionner —</option>
            {matrices.items.map((m) => (
              <option key={m.code} value={m.code}>
                {m.label}
              </option>
            ))}
            <option disabled>──────────</option>
            <option value={NEW_MATRICE_VALUE}>+ Créer une nouvelle matrice…</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Texte de la recommandation <span className="text-danger">*</span>
          </label>
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={6}
            disabled={submitting}
            placeholder="Ex. : Finaliser le rapport d'avancement Q2 et le présenter au prochain COPIL"
            className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-y"
          />
          <p className="text-xs text-fg-muted mt-1.5">
            État initial : <b>En attente</b>. Tu pourras le changer ensuite depuis Saisie matrices.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate('/bs/liste')}
            disabled={submitting}
          >
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSubmit()}
            disabled={submitting || !selectedMatrice || texte.trim().length < 3}
          >
            <Plus className="w-4 h-4" />
            {submitting ? 'Création…' : 'Créer la recommandation'}
          </button>
        </div>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={closeNewMatriceModal}
        >
          <div
            className="bg-surface rounded-xl border border-border w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {newMatriceStep === 'confirm' ? (
              <>
                <div className="flex items-start justify-between px-5 py-4 border-b border-border">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-warning-bg text-warning flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">Créer une nouvelle matrice ?</h2>
                      <p className="text-xs text-fg-muted mt-1">
                        Les matrices structurent les recommandations (COPIL, Réformes, CNGI). Crée une
                        nouvelle matrice uniquement si elle n&apos;existe pas encore dans la liste.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeNewMatriceModal}
                    className="p-1 text-fg-muted hover:text-fg rounded hover:bg-muted"
                    aria-label="Fermer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="px-5 py-4 text-sm text-fg-2">
                  Réservé aux administrateurs. Si tu n&apos;es pas admin, demande à un administrateur de
                  créer la matrice via la page Configuration.
                </div>
                <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
                  <button type="button" className="btn btn-ghost" onClick={closeNewMatriceModal}>
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setNewMatriceStep('form')}
                  >
                    <FolderPlus className="w-4 h-4" /> Oui, continuer
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between px-5 py-4 border-b border-border">
                  <div>
                    <h2 className="text-base font-semibold">Nouvelle matrice</h2>
                    <p className="text-xs text-fg-muted mt-1">
                      Choisis un libellé clair (visible partout) et un code court (utilisé en interne).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeNewMatriceModal}
                    disabled={creatingMatrice}
                    className="p-1 text-fg-muted hover:text-fg rounded hover:bg-muted"
                    aria-label="Fermer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Libellé <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={newMatriceLabel}
                      onChange={(e) => setNewMatriceLabel(e.target.value)}
                      autoFocus
                      placeholder="Ex. : COPIL Drainage Saint-Louis"
                      className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Code <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={newMatriceCode}
                      onChange={(e) => {
                        setNewMatriceCode(e.target.value);
                        setCodeManuallyEdited(true);
                      }}
                      placeholder="copilDrainageSaintLouis"
                      className="w-full px-3 py-2 border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                    <p className="text-[11px] text-fg-muted mt-1">
                      Auto-généré depuis le libellé · lettres, chiffres, <code>-</code> et <code>_</code> uniquement.
                    </p>
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setNewMatriceStep('confirm')}
                    disabled={creatingMatrice}
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleCreateMatrice()}
                    disabled={creatingMatrice || !newMatriceLabel || !newMatriceCode}
                  >
                    {creatingMatrice ? 'Création…' : 'Créer la matrice'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
