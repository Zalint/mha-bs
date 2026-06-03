import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  FileText,
  Mic,
  Pencil,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Spinner } from '../components/ui/Spinner.js';
import { useApi } from '../hooks/useApi.js';
import { useReferentiel } from '../hooks/useReferentiel.js';
import { ApiClientError, api } from '../lib/apiClient.js';
import { cn } from '../lib/cn.js';
import { env } from '../lib/env.js';
import { formatShort } from '../lib/formatDate.js';
import { useAuthStore } from '../stores/authStore.js';

interface Interpellation {
  id: string;
  reference: string;
  deputeId: string;
  deputeNom: string | null;
  deputeGroupe: string | null;
  sessionId: string | null;
  sessionIntitule: string | null;
  titre: string;
  description: string | null;
  typeInterpellation: string;
  dateReception: string;
  echeanceReponse: string | null;
  dateReponse: string | null;
  etat: string;
  texteReponse: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InterpellationStats {
  total: number;
  parEtat: Record<string, number>;
  parType: Record<string, number>;
  parGroupe: Record<string, number>;
}

interface DeputeLite {
  id: string;
  nomComplet: string;
  groupeParlementaire: string;
  region: string | null;
  isActive: boolean;
}

const ETAT_STYLES: Record<string, string> = {
  recue: 'bg-info-bg text-info',
  enPreparation: 'bg-warning-bg text-warning',
  aValider: 'bg-primary-100 text-primary-700',
  repondue: 'bg-success-bg text-success',
};

export function InterpellationsView() {
  const navigate = useNavigate();
  const userRole = useAuthStore((s) => s.user?.role);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAdmin = userRole === 'admin';
  const canEdit = userRole === 'admin' || userRole === 'bs';

  const listQuery = useApi(() => api.get<{ items: Interpellation[] }>('/interpellations'), []);
  const statsQuery = useApi(() => api.get<InterpellationStats>('/interpellations/stats'), []);
  const deputesQuery = useApi(() => api.get<{ items: DeputeLite[] }>('/deputes'), []);
  const etatRef = useReferentiel('etatInterpellation');
  const typeRef = useReferentiel('typeInterpellation');
  const groupeRef = useReferentiel('groupeParlementaire');

  // Liste triée pour le dropdown — actifs en premier, alphabétique
  const deputesOptions = useMemo(() => {
    const list = deputesQuery.data?.items ?? [];
    return [...list].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.nomComplet.localeCompare(b.nomComplet, 'fr');
    });
  }, [deputesQuery.data]);

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);
  const stats = statsQuery.data;

  const etatLabel = (code: string): string =>
    etatRef.items.find((r) => r.code === code)?.label ?? code;
  const typeLabel = (code: string): string =>
    typeRef.items.find((r) => r.code === code)?.label ?? code;

  // === Sélection multiple pour bulk delete (admin) ===
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const toggleAll = (): void => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((i) => i.id)));
  };
  const toggleOne = (id: string): void => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // === Édition inline ===
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Interpellation>>({});

  const startEdit = (it: Interpellation): void => {
    setEditingId(it.id);
    setEditDraft({
      titre: it.titre,
      description: it.description,
      typeInterpellation: it.typeInterpellation,
      etat: it.etat,
      dateReception: it.dateReception,
      deputeId: it.deputeId,
      // Snapshot du groupe initial du député — sert à comparer pour décider
      // si on doit faire un PUT /deputes/:id à la sauvegarde
      deputeGroupe: it.deputeGroupe,
    });
  };
  const cancelEdit = (): void => {
    setEditingId(null);
    setEditDraft({});
  };
  const saveEdit = async (id: string, originalDeputeGroupe: string | null): Promise<void> => {
    try {
      // 1) Si le groupe parlementaire a été modifié, on met à jour le DÉPUTÉ
      //    associé (PAS l'interpellation — le groupe est porté par le député).
      //    On filtre sur l'existence d'un deputeId valide et d'un changement réel.
      const newGroupe = editDraft.deputeGroupe ?? null;
      const deputeId = editDraft.deputeId ?? null;
      if (deputeId && newGroupe && newGroupe !== originalDeputeGroupe) {
        await api.put(`/deputes/${deputeId}`, { groupeParlementaire: newGroupe });
      }

      // 2) PUT interpellation — on retire deputeGroupe avant l'envoi (pas accepté
      //    par le schéma Zod côté backend, c'est un champ join read-only).
      const { deputeGroupe: _ignore, ...interpellationPatch } = editDraft;
      void _ignore;
      await api.put(`/interpellations/${id}`, interpellationPatch);

      toast.success('Interpellation mise à jour');
      cancelEdit();
      listQuery.refetch();
      statsQuery.refetch();
      deputesQuery.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Erreur de mise à jour");
    }
  };

  const deleteOne = async (id: string): Promise<void> => {
    if (!window.confirm('Supprimer cette interpellation ?')) return;
    try {
      await api.delete(`/interpellations/${id}`);
      toast.success('Interpellation supprimée');
      listQuery.refetch();
      statsQuery.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur de suppression');
    }
  };

  const bulkDelete = async (): Promise<void> => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Supprimer ${selectedIds.size} interpellation(s) ? Action irréversible.`))
      return;
    try {
      const res = await api.post<{ deleted: number }>('/interpellations/bulk-delete', {
        ids: Array.from(selectedIds),
      });
      toast.success(`${res.deleted} interpellation(s) supprimée(s)`);
      setSelectedIds(new Set());
      listQuery.refetch();
      statsQuery.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur de suppression');
    }
  };

  const handleExport = async (): Promise<void> => {
    try {
      const url = `${env.apiBaseUrl.replace(/\/$/, '')}/interpellations/export.xlsx`;
      const res = await fetch(url, {
        method: 'GET',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `mha-interpellations.xlsx`;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      toast.success(`Téléchargement de ${filename}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'export");
    }
  };

  if (listQuery.isLoading || statsQuery.isLoading) {
    return <Spinner label="Chargement des interpellations…" />;
  }

  const isOverdue = (i: Interpellation): boolean => {
    if (!i.echeanceReponse || i.etat === 'repondue') return false;
    return new Date(i.echeanceReponse) < new Date();
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fg leading-tight flex items-center gap-2.5">
            <Mic className="w-6 h-6 text-primary" strokeWidth={1.8} />
            Interpellations parlementaires
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            Questions orales, écrites et interpellations en commission posées par les députés au MHA
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleExport()}
            className="btn btn-secondary"
            title="Format compatible avec l'import (1er onglet 'In. des députés')"
          >
            <Download className="w-3.5 h-3.5" /> Exporter Excel
          </button>
          {isAdmin && selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => void bulkDelete()}
              className="btn bg-danger text-white hover:bg-danger/90"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiBlock
          icon={ClipboardList}
          label="Total interpellations"
          value={stats?.total ?? 0}
          delta="depuis l'origine"
        />
        <KpiBlock
          icon={CheckCircle2}
          label="Répondues"
          value={stats?.parEtat.repondue ?? 0}
          delta={stats && stats.total > 0
            ? `${Math.round(((stats.parEtat.repondue ?? 0) / stats.total) * 100)} % du total`
            : '—'}
          variant="success"
        />
        <KpiBlock
          icon={Clock}
          label="En préparation"
          value={(stats?.parEtat.enPreparation ?? 0) + (stats?.parEtat.aValider ?? 0)}
          delta={`${stats?.parEtat.enPreparation ?? 0} prep · ${stats?.parEtat.aValider ?? 0} à valider`}
          variant="warning"
        />
        <KpiBlock
          icon={FileText}
          label="Reçues"
          value={stats?.parEtat.recue ?? 0}
          delta="non démarrées"
          variant="info"
        />
      </div>

      {/* Répartitions */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 mb-5">
        <div className="bg-surface rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-primary" />
            Par type
          </h3>
          {stats && Object.keys(stats.parType).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(stats.parType).map(([type, count]) => (
                <BarRow key={type} label={typeLabel(type)} value={count} max={stats.total} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-fg-muted text-center py-6">Pas de données</p>
          )}
        </div>
        <div className="bg-surface rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-primary" />
            Par groupe parlementaire
          </h3>
          {stats && Object.keys(stats.parGroupe).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(stats.parGroupe)
                .sort(([, a], [, b]) => b - a)
                .map(([groupe, count]) => (
                  <BarRow key={groupe} label={groupe} value={count} max={stats.total} />
                ))}
            </div>
          ) : (
            <p className="text-sm text-fg-muted text-center py-6">Pas de données</p>
          )}
        </div>
      </div>

      {/* Liste */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface2 flex items-center justify-between">
          <h2 className="text-md font-semibold">Liste des interpellations</h2>
          <span className="text-xs text-fg-muted font-mono">
            {items.length} interpellation{items.length > 1 ? 's' : ''}
          </span>
        </div>
        {items.length === 0 ? (
          <div className="text-center text-fg-muted py-12 text-sm">
            Aucune interpellation enregistrée pour le moment.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="bg-surface2">
                <tr>
                  {isAdmin && (
                    <th className="px-3 py-2.5 border-b border-border w-10">
                      <input
                        type="checkbox"
                        aria-label="Tout sélectionner"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="accent-primary"
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-24">
                    Date
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-44">
                    Député
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-32">
                    Groupe parlementaire
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-24">
                    Type
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border">
                    Titre / question
                  </th>
                  <th className="text-center px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-32">
                    État
                  </th>
                  {canEdit && (
                    <th className="text-center px-3 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-24">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const isEditing = editingId === i.id;
                  const isSelected = selectedIds.has(i.id);
                  return (
                    <tr
                      key={i.id}
                      className={cn(
                        'border-b border-border last:border-0 hover:bg-muted',
                        isSelected && 'bg-primary-100/30',
                        isEditing && 'bg-warning-bg/30',
                      )}
                    >
                      {isAdmin && (
                        <td className="px-3 py-3 align-top">
                          <input
                            type="checkbox"
                            aria-label="Sélectionner"
                            checked={isSelected}
                            onChange={() => toggleOne(i.id)}
                            className="accent-primary"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono text-xs text-fg-muted align-top">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editDraft.dateReception ?? ''}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, dateReception: e.target.value })
                            }
                            className="input input-sm text-xs w-32"
                          />
                        ) : (
                          formatShort(i.dateReception)
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <select
                            value={editDraft.deputeId ?? ''}
                            onChange={(e) => {
                              const newId = e.target.value;
                              // Quand on change de député, on synchronise aussi le
                              // groupe parlementaire affiché — l'utilisateur peut
                              // ensuite l'overrider via le select Groupe.
                              const newDepute = deputesOptions.find((d) => d.id === newId);
                              setEditDraft({
                                ...editDraft,
                                deputeId: newId,
                                deputeGroupe: newDepute?.groupeParlementaire ?? null,
                              });
                            }}
                            className="input input-sm text-xs w-full min-w-[10rem]"
                          >
                            <option value="" disabled>
                              — Choisir un député —
                            </option>
                            {deputesOptions.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.nomComplet}
                                {d.groupeParlementaire && d.groupeParlementaire !== 'Non renseigne'
                                  ? ` · ${d.groupeParlementaire}`
                                  : ''}
                                {!d.isActive ? ' (inactif)' : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="font-medium text-sm">
                            {i.deputeNom ?? <span className="italic text-fg-muted">non lié</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <select
                            value={editDraft.deputeGroupe ?? ''}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                deputeGroupe: e.target.value || null,
                              })
                            }
                            className="input input-sm text-xs w-full min-w-[8rem]"
                            title="Modifie le groupe du député associé"
                          >
                            <option value="">— Non renseigné —</option>
                            {groupeRef.items.map((g) => (
                              <option key={g.code} value={g.code}>
                                {g.label}
                              </option>
                            ))}
                            {/* Si le groupe actuel n'est pas dans le référentiel
                                (ex. ancienne donnée), on l'ajoute pour préserver
                                la valeur affichée. */}
                            {editDraft.deputeGroupe &&
                              !groupeRef.items.some(
                                (g) => g.code === editDraft.deputeGroupe,
                              ) && (
                                <option value={editDraft.deputeGroupe}>
                                  {editDraft.deputeGroupe}
                                </option>
                              )}
                          </select>
                        ) : (
                          <span
                            className={cn(
                              'inline-block px-2 py-0.5 rounded text-[11px] font-medium',
                              i.deputeGroupe && i.deputeGroupe !== 'Non renseigne'
                                ? 'bg-primary-100 text-primary-700'
                                : 'bg-muted text-fg-muted italic',
                            )}
                          >
                            {i.deputeGroupe ?? 'Non renseigné'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs align-top">
                        {isEditing ? (
                          <select
                            value={editDraft.typeInterpellation ?? ''}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, typeInterpellation: e.target.value })
                            }
                            className="input input-sm text-xs"
                          >
                            <option value="ecrite">Écrite</option>
                            <option value="orale">Orale</option>
                            <option value="commission">Commission</option>
                          </select>
                        ) : (
                          typeLabel(i.typeInterpellation)
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <textarea
                            value={editDraft.titre ?? ''}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, titre: e.target.value })
                            }
                            className="input text-sm w-full min-h-[60px]"
                          />
                        ) : (
                          <>
                            <div className="text-sm font-medium line-clamp-3">{i.titre}</div>
                            {i.description && (
                              <div className="text-[10.5px] text-fg-muted mt-1 italic line-clamp-1">
                                {i.description}
                              </div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center align-top">
                        {isEditing ? (
                          <select
                            value={editDraft.etat ?? ''}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, etat: e.target.value })
                            }
                            className="input input-sm text-xs"
                          >
                            <option value="recue">Reçue</option>
                            <option value="enPreparation">En préparation</option>
                            <option value="aValider">À valider</option>
                            <option value="repondue">Répondue</option>
                          </select>
                        ) : (
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold',
                              isOverdue(i) && i.etat !== 'repondue'
                                ? 'bg-danger-bg text-danger'
                                : ETAT_STYLES[i.etat] ?? 'bg-muted text-fg-2',
                            )}
                          >
                            {etatLabel(i.etat)}
                          </span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-3 py-3 text-center align-top">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => void saveEdit(i.id, i.deputeGroupe)}
                                className="text-xs px-2 py-1 bg-success text-white rounded hover:opacity-90"
                              >
                                ✓ Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="text-fg-muted hover:text-fg p-1"
                                aria-label="Annuler"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => startEdit(i)}
                                className="text-fg-muted hover:text-primary p-1"
                                aria-label="Éditer"
                                title="Éditer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => void deleteOne(i.id)}
                                  className="text-fg-muted hover:text-danger p-1"
                                  aria-label="Supprimer"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-fg-muted italic mt-4">
        La saisie d&apos;une interpellation se fait via le module BS (à venir). Les états sont
        configurables dans <button
          type="button"
          onClick={() => navigate('/bs/config')}
          className="text-primary hover:underline"
        >Configuration</button>.
      </p>
    </div>
  );
}

interface KpiBlockProps {
  icon: typeof Mic;
  label: string;
  value: number;
  delta: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const KPI_STYLES = {
  default: 'text-fg',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-primary',
} as const;

function KpiBlock({ icon: Icon, label, value, delta, variant = 'default' }: KpiBlockProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 relative">
      <Icon className="w-4 h-4 text-fg-muted absolute top-4 right-4" />
      <div className="text-[10.5px] uppercase tracking-wider text-fg-muted font-medium">{label}</div>
      <div className={cn('font-mono text-3xl font-bold mt-1 tabular-nums', KPI_STYLES[variant])}>
        {value}
      </div>
      <div className="text-[11.5px] text-fg-muted mt-1">{delta}</div>
    </div>
  );
}

interface BarRowProps {
  label: string;
  value: number;
  max: number;
}

function BarRow({ label, value, max }: BarRowProps) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="grid grid-cols-[130px_1fr_40px] gap-3 items-center text-sm">
      <span className="truncate text-fg-2">{label}</span>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.max(pct, 3)}%` }} />
      </div>
      <span className="font-mono text-sm font-semibold text-right tabular-nums">{value}</span>
    </div>
  );
}
