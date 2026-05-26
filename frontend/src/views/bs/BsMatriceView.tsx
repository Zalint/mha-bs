import { ArrowRight, Cloud, CloudRain, Droplets, FolderKanban, History, Landmark, Move, Plus, Send, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  type DirectiveEtat,
  type RecommandationMatrice,
} from '@mha-bs/shared';

import { Spinner } from '../../components/ui/Spinner.js';
import { useApi } from '../../hooks/useApi.js';
import { useReferentiel } from '../../hooks/useReferentiel.js';
import { ApiClientError, api } from '../../lib/apiClient.js';
import { cn } from '../../lib/cn.js';

// Metadonnees visuelles internes (sub + icone + initiales) par code de matrice.
// Si une nouvelle matrice est ajoutee via Config, on tombe sur le fallback générique.
const MATRICE_META: Record<string, { sub: string; ic: string; icon: typeof FolderKanban }> = {
  cngi: { sub: "Comité national de Gestion Intégrée des Inondations", ic: 'CN', icon: CloudRain },
  reformeAssainissement: { sub: 'Cadre légal et institutionnel · recommandations stratégiques', ic: 'RA', icon: Droplets },
  reformeInstitutionnelle: { sub: 'ARSE, DSP, feuille de route 2026', ic: 'RI', icon: Landmark },
  copilProgepIi: { sub: 'Projet de Gestion des Eaux Pluviales · Phase II', ic: 'PG', icon: FolderKanban },
  copilPisea: { sub: "Programme d'Investissement Sectoriel Eau-Assainissement", ic: 'PS', icon: FolderKanban },
  copilPaseaRd: { sub: "Programme d'Appui Eau-Assainissement (Diourbel)", ic: 'PR', icon: FolderKanban },
  copilPdbh: { sub: 'Programme Drainage Baie de Hann', ic: 'PB', icon: FolderKanban },
  copilPromoren: { sub: 'Projet de Mobilisation des Ressources en Eau', ic: 'PM', icon: FolderKanban },
};

function getMatriceMeta(code: string): { sub: string; ic: string; icon: typeof FolderKanban } {
  if (MATRICE_META[code]) return MATRICE_META[code];
  // Fallback : initiales depuis le code (ex. "copilXyz" → "CX")
  const ic = (code.match(/[A-Z0-9]/g) ?? [code[0] ?? '?', code[1] ?? '']).slice(0, 2).join('').toUpperCase() || '??';
  return { sub: 'Matrice personnalisee', ic, icon: FolderKanban };
}

const ETAT_LABELS: Record<DirectiveEtat, string> = {
  attente: 'Attente',
  enCours: 'En cours',
  realisee: 'Réalisée',
  ineligible: 'Inéligible',
};

const ETAT_RADIO_STYLES: Record<DirectiveEtat, string> = {
  attente: 'data-[checked=true]:bg-info-bg data-[checked=true]:text-info data-[checked=true]:shadow-sm',
  enCours: 'data-[checked=true]:bg-warning-bg data-[checked=true]:text-warning data-[checked=true]:shadow-sm',
  realisee: 'data-[checked=true]:bg-success-bg data-[checked=true]:text-success data-[checked=true]:shadow-sm',
  ineligible: 'data-[checked=true]:bg-neutral-bg data-[checked=true]:text-neutral data-[checked=true]:shadow-sm',
};

export function BsMatriceView() {
  const typeMatriceRef = useReferentiel('typeMatrice');
  const categoriesRef = useReferentiel('matriceCategorie');
  const [current, setCurrent] = useState<string>('cngi');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string>('—');

  const allQuery = useApi(() => api.get<{ items: RecommandationMatrice[] }>('/matrices'), []);

  const allItems = allQuery.data?.items ?? [];
  const currentItems = useMemo(
    () => allItems.filter((r) => r.typeMatrice === current).sort((a, b) => a.numOrdre - b.numOrdre),
    [allItems, current],
  );

  // Local edits buffer pour observations (debounced à 1s sur blur)
  const [obsDraft, setObsDraft] = useState<Record<string, string>>({});

  // Modale création
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newText, setNewText] = useState('');

  // Modale réassignation
  const [reassignTarget, setReassignTarget] = useState<RecommandationMatrice | null>(null);
  const [reassignDest, setReassignDest] = useState<string>('');
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    setObsDraft({});
  }, [current]);

  const openReassign = (item: RecommandationMatrice): void => {
    setReassignTarget(item);
    setReassignDest('');
  };
  const closeReassign = (): void => {
    if (reassigning) return;
    setReassignTarget(null);
    setReassignDest('');
  };
  // Catégorie courante de la matrice active (lue depuis le référentiel)
  const currentMatriceRef = typeMatriceRef.items.find((t) => t.code === current);
  const currentCategorie = currentMatriceRef?.parentCode ?? '';

  const handleCategorieChange = async (newCategorie: string): Promise<void> => {
    if (!currentMatriceRef) return;
    try {
      await api.put(`/referentiels/${currentMatriceRef.id}`, {
        parentCode: newCategorie || null,
      });
      const catLabel = categoriesRef.items.find((c) => c.code === newCategorie)?.label ?? 'Autres';
      toast.success(`${currentMatriceRef.label} → ${catLabel}`);
      typeMatriceRef.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Échec de la mise à jour");
    }
  };

  const handleReassign = async (): Promise<void> => {
    if (!reassignTarget || !reassignDest || reassignDest === reassignTarget.typeMatrice) return;
    setReassigning(true);
    try {
      await api.put(
        `/matrices/${reassignTarget.typeMatrice}/${reassignTarget.numOrdre}/reassign`,
        { newTypeMatrice: reassignDest },
      );
      const destLabel = typeMatriceRef.items.find((t) => t.code === reassignDest)?.label ?? reassignDest;
      toast.success(`Recommandation déplacée vers ${destLabel}`);
      setReassignTarget(null);
      setReassignDest('');
      allQuery.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Échec de la réassignation');
    } finally {
      setReassigning(false);
    }
  };

  const handleCreate = async (): Promise<void> => {
    const text = newText.trim();
    if (text.length < 3) {
      toast.error('Texte trop court (3 caractères minimum)');
      return;
    }
    setCreating(true);
    try {
      await api.post<RecommandationMatrice>('/matrices', {
        typeMatrice: current,
        texteRecommandation: text,
      });
      toast.success('Recommandation ajoutée');
      setNewText('');
      setCreateOpen(false);
      allQuery.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Échec de la création");
    } finally {
      setCreating(false);
    }
  };

  const stats = useMemo(() => {
    const counts: Record<string, { total: number; realisees: number }> = {};
    // Initialise les compteurs pour chaque code de matrice connu dans le referentiel
    for (const t of typeMatriceRef.items) counts[t.code] = { total: 0, realisees: 0 };
    for (const r of allItems) {
      if (!counts[r.typeMatrice]) counts[r.typeMatrice] = { total: 0, realisees: 0 };
      counts[r.typeMatrice].total++;
      if (r.etat === 'realisee') counts[r.typeMatrice].realisees++;
    }
    return counts;
  }, [allItems, typeMatriceRef.items]);

  const currentTypeLabel = typeMatriceRef.items.find((t) => t.code === current)?.label ?? current;
  const currentMetaVisual = getMatriceMeta(current);
  const currentStats = stats[current] ?? { total: 0, realisees: 0 };
  const pctCurrent =
    currentStats && currentStats.total > 0
      ? Math.round((currentStats.realisees / currentStats.total) * 100)
      : 0;

  const persistEtat = async (item: RecommandationMatrice, newEtat: DirectiveEtat): Promise<void> => {
    setSavingId(item.id);
    try {
      await api.put(`/matrices/${item.typeMatrice}/${item.numOrdre}`, { etat: newEtat });
      setLastSavedAt(new Date().toTimeString().slice(0, 5));
      toast.success(`${item.typeMatrice} #${item.numOrdre} → ${ETAT_LABELS[newEtat]}`);
      allQuery.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur de sauvegarde');
    } finally {
      setSavingId(null);
    }
  };

  const persistObs = async (item: RecommandationMatrice, value: string): Promise<void> => {
    if ((item.observations ?? '') === value) return;
    setSavingId(item.id);
    try {
      await api.put(`/matrices/${item.typeMatrice}/${item.numOrdre}`, { observations: value || null });
      setLastSavedAt(new Date().toTimeString().slice(0, 5));
      allQuery.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur de sauvegarde');
    } finally {
      setSavingId(null);
    }
  };

  if (allQuery.isLoading) return <Spinner label="Chargement des matrices…" />;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg leading-tight">Saisie matrices</h1>
      <p className="text-sm text-fg-muted mt-1 mb-5">
        Mise à jour rapide des recommandations COPIL, CNGI et Réformes. Sauvegarde automatique au
        changement.
      </p>

      {/* Selecteur de matrices */}
      <div className="grid gap-2.5 mb-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
        {typeMatriceRef.items.map((t) => {
          const s = stats[t.code] ?? { total: 0, realisees: 0 };
          const meta = getMatriceMeta(t.code);
          const Icon = meta.icon;
          const active = current === t.code;
          return (
            <button
              key={t.code}
              type="button"
              onClick={() => setCurrent(t.code)}
              className={cn(
                'bg-surface border rounded-md p-3.5 cursor-pointer text-left flex flex-col gap-1.5 transition-colors',
                active ? 'border-primary bg-primary-50' : 'border-border hover:border-primary',
              )}
            >
              <Icon className={cn('w-5 h-5', active ? 'text-primary' : 'text-primary')} strokeWidth={1.8} />
              <div className="text-sm font-semibold text-fg leading-tight">{t.label}</div>
              <div className={cn('text-[11.5px] font-mono', active ? 'text-primary-700' : 'text-fg-muted')}>
                {s.total} reco · {s.realisees} réalisée(s)
              </div>
            </button>
          );
        })}
      </div>

      {/* Save bar */}
      <div className="bg-primary-100 border border-primary rounded-lg px-4 py-2.5 mb-3.5 flex items-center gap-3 text-sm">
        <Cloud className="w-4 h-4 text-primary" />
        <span className="flex-1 text-primary-700">
          Sauvegarde automatique · <b>{savingId ? 'enregistrement en cours…' : 'à jour'}</b> · dernière
          sauvegarde <span className="font-mono">{lastSavedAt}</span>
        </span>
        <button type="button" className="btn btn-sm btn-secondary" disabled>
          <History className="w-3 h-3" /> Historique
        </button>
        <button type="button" className="btn btn-sm btn-primary" disabled>
          <Send className="w-3 h-3" /> Soumettre
        </button>
      </div>

      {/* Matrix table */}
      {current && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="bg-surface2 border-b border-border px-4 py-3 flex items-center gap-3 flex-wrap">
            <div className="w-8 h-8 rounded bg-primary text-white flex items-center justify-center font-mono font-semibold text-xs">
              {currentMetaVisual.ic}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-fg">{currentTypeLabel}</div>
              <div className="text-xs text-fg-muted">{currentMetaVisual.sub} · {currentItems.length} recommandations</div>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-fg-muted">
              <span>Catégorie</span>
              <select
                value={currentCategorie}
                onChange={(e) => void handleCategorieChange(e.target.value)}
                className="rounded border border-border bg-surface px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Autres</option>
                {categoriesRef.items
                  .filter((c) => c.code !== 'autres')
                  .map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
              </select>
            </label>
            <div className="w-36 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full" style={{ width: `${pctCurrent}%` }} />
            </div>
            <span className="font-mono font-semibold text-sm min-w-[40px] text-right">{pctCurrent}%</span>
            <button
              type="button"
              className="btn btn-sm btn-primary ml-2"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" /> Nouvelle recommandation
            </button>
          </div>

          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="bg-surface2">
              <tr>
                <th className="text-left px-3 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-10">
                  #
                </th>
                <th className="text-left px-3 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border">
                  Recommandation
                </th>
                <th className="text-center px-3 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-[280px]">
                  État
                </th>
                <th className="text-left px-3 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-[240px]">
                  Observations
                </th>
                <th className="text-center px-3 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-[100px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-fg-muted py-12 text-sm">
                    Aucune recommandation dans cette matrice.
                  </td>
                </tr>
              ) : (
                currentItems.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface2">
                    <td className="px-3 py-3.5 align-top font-mono text-xs font-semibold text-fg-muted">
                      {r.numOrdre}
                    </td>
                    <td className="px-3 py-3.5 align-top text-sm leading-relaxed text-fg">
                      {r.texteRecommandation}
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      <div className="inline-flex gap-1 p-0.5 bg-muted rounded">
                        {(['attente', 'enCours', 'realisee'] as DirectiveEtat[]).map((e) => {
                          const checked = r.etat === e;
                          return (
                            <button
                              key={e}
                              type="button"
                              data-checked={checked}
                              onClick={() => void persistEtat(r, e)}
                              className={cn(
                                'px-2.5 py-1.5 text-xs font-medium rounded text-fg-2 transition-colors',
                                ETAT_RADIO_STYLES[e],
                                !checked && 'hover:bg-surface',
                              )}
                            >
                              {ETAT_LABELS[e]}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      <textarea
                        rows={2}
                        defaultValue={r.observations ?? ''}
                        onChange={(e) => setObsDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                        onBlur={() => {
                          const draft = obsDraft[r.id];
                          if (draft !== undefined) void persistObs(r, draft);
                        }}
                        placeholder="Observations…"
                        className="w-full px-2.5 py-1.5 text-xs border border-transparent hover:border-border focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 rounded bg-transparent resize-y"
                      />
                    </td>
                    <td className="px-3 py-3.5 align-top text-center">
                      <button
                        type="button"
                        onClick={() => openReassign(r)}
                        title="Réassigner à une autre matrice"
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-fg-muted hover:text-primary hover:bg-primary-100 rounded transition-colors"
                      >
                        <Move className="w-3.5 h-3.5" /> Réassigner
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !creating && setCreateOpen(false)}
        >
          <div
            className="bg-surface rounded-xl border border-border w-full max-w-xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold">Nouvelle recommandation</h2>
                <p className="text-xs text-fg-muted mt-0.5">
                  Sera ajoutée à <b>{currentTypeLabel}</b>. Le numéro d&apos;ordre est attribué
                  automatiquement (n° {currentItems.length + 1}).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
                className="p-1 text-fg-muted hover:text-fg rounded hover:bg-muted"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <label className="block text-sm font-medium mb-1.5">
                Texte de la recommandation <span className="text-danger">*</span>
              </label>
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                rows={5}
                autoFocus
                placeholder="Ex. : Finaliser le rapport d'avancement Q2 et le présenter au prochain COPIL"
                className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-y"
              />
              <p className="text-xs text-fg-muted mt-1.5">
                État initial : <b>En attente</b>. Tu pourras le changer ensuite directement dans la matrice.
              </p>
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleCreate()}
                disabled={creating || newText.trim().length < 3}
              >
                {creating ? 'Création…' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reassignTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={closeReassign}
        >
          <div
            className="bg-surface rounded-xl border border-border w-full max-w-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
                  <Move className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Réassigner la recommandation</h2>
                  <p className="text-xs text-fg-muted mt-1">
                    La recommandation <b>{reassignTarget.typeMatrice} #{reassignTarget.numOrdre}</b>{' '}
                    sera déplacée et recevra un nouveau numéro d&apos;ordre dans la matrice cible.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeReassign}
                disabled={reassigning}
                className="p-1 text-fg-muted hover:text-fg rounded hover:bg-muted"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="bg-muted rounded p-3 text-sm text-fg-2 leading-relaxed">
                <div className="text-[11px] uppercase tracking-wider text-fg-muted font-medium mb-1">
                  Texte
                </div>
                {reassignTarget.texteRecommandation}
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium mb-1 text-fg-muted">Matrice actuelle</label>
                  <div className="px-3 py-2 border border-border rounded text-sm bg-muted font-mono">
                    {typeMatriceRef.items.find((t) => t.code === reassignTarget.typeMatrice)?.label ?? reassignTarget.typeMatrice}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-fg-muted mb-3" />
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Nouvelle matrice <span className="text-danger">*</span>
                  </label>
                  <select
                    value={reassignDest}
                    onChange={(e) => setReassignDest(e.target.value)}
                    disabled={reassigning}
                    className="w-full px-3 py-2 border border-border rounded text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="">— Sélectionner —</option>
                    {typeMatriceRef.items
                      .filter((t) => t.code !== reassignTarget.typeMatrice)
                      .map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.label}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeReassign}
                disabled={reassigning}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleReassign()}
                disabled={reassigning || !reassignDest}
              >
                {reassigning ? 'Réassignation…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
