import { AlertTriangle, CheckCircle2, Clock, Download, Plus, Trash2, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type { PaginatedResponse, Directive, TypeRencontre } from '@mha-bs/shared';

import { DirectiveFiltersBar, type DirectiveFiltersValue } from '../components/directives/DirectiveFilters.js';
import { DirectiveTable } from '../components/directives/DirectiveTable.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { Spinner } from '../components/ui/Spinner.js';
import { StatStrip, type StatCell } from '../components/ui/StatStrip.js';
import { useApi } from '../hooks/useApi.js';
import { ApiClientError, api } from '../lib/apiClient.js';
import { useAuthStore } from '../stores/authStore.js';

interface Props {
  typeRencontre: TypeRencontre;
}

interface KpisResponse {
  totalDirectives: number;
  nbRealisees: number;
  nbEnCours: number;
  nbAttente: number;
  nbIneligibles: number;
  nbRetards: number;
  tauxExecution: number;
}

const PAGE_SIZE = 50;
const CURRENT_YEAR = new Date().getUTCFullYear();
const AVAILABLE_YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3];

export function DirectivesListView({ typeRencontre }: Props) {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin';
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<DirectiveFiltersValue>({ annee: '', etat: '', search: '' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'single'; id: string } | { kind: 'bulk' } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number | undefined> = {
      typeRencontre,
      page,
      pageSize: PAGE_SIZE,
    };
    if (filters.annee) params.annee = Number(filters.annee);
    if (filters.etat) params.etat = filters.etat;
    if (filters.search) params.search = filters.search;
    return params;
  }, [typeRencontre, page, filters]);

  const directivesQuery = useApi(
    () => api.get<PaginatedResponse<Directive>>('/directives', { query: queryParams }),
    [typeRencontre, page, filters.annee, filters.etat, filters.search],
  );

  const kpisQuery = useApi(
    () => api.get<KpisResponse>('/dashboard/kpis', { query: { typeRencontre } }),
    [typeRencontre],
  );

  const stripCells: StatCell[] = useMemo(() => {
    const k = kpisQuery.data;
    if (!k) return [];
    return [
      { label: 'Total', value: k.totalDirectives, subtitle: 'depuis 2024' },
      { label: 'Réalisées', value: k.nbRealisees, subtitle: `${k.tauxExecution} %`, variant: 'success' },
      {
        label: 'En cours',
        value: k.nbEnCours,
        subtitle: `${Math.round(((k.nbEnCours || 0) / Math.max(k.totalDirectives, 1)) * 100)} %`,
        variant: 'warning',
      },
      {
        label: 'En attente',
        value: k.nbAttente,
        subtitle: `${Math.round(((k.nbAttente || 0) / Math.max(k.totalDirectives, 1)) * 100)} %`,
        variant: 'info',
      },
      { label: 'Inéligibles', value: k.nbIneligibles, subtitle: 'hors périmètre' },
      {
        label: 'Échéance dépassée',
        value: k.nbRetards,
        subtitle: 'à relancer',
        variant: 'danger',
      },
    ];
  }, [kpisQuery.data]);

  const handleFiltersChange = (next: DirectiveFiltersValue): void => {
    setFilters(next);
    setPage(1);
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      if (confirmDelete.kind === 'single') {
        await api.delete(`/directives/${confirmDelete.id}`);
        toast.success('Directive supprimée');
      } else {
        const res = await api.post<{ deleted: number }>('/directives/bulk-delete', {
          ids: selectedIds,
        });
        toast.success(`${res.deleted} directive${res.deleted > 1 ? 's' : ''} supprimée${res.deleted > 1 ? 's' : ''}`);
        setSelectedIds([]);
      }
      directivesQuery.refetch();
      kpisQuery.refetch();
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Échec de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-end gap-2 mb-3">
        {isAdmin && selectedIds.length > 0 && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setConfirmDelete({ kind: 'bulk' })}
          >
            <Trash2 className="w-4 h-4" /> Supprimer ({selectedIds.length})
          </button>
        )}
        <button type="button" className="btn btn-secondary">
          <Download className="w-4 h-4" /> Exporter
        </button>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/bs/fiche')}>
          <Plus className="w-4 h-4" /> Nouvelle directive
        </button>
      </div>

      {kpisQuery.isLoading ? (
        <Spinner label="Chargement des indicateurs…" />
      ) : kpisQuery.error ? (
        <ErrorBanner message="Impossible de charger les indicateurs" />
      ) : (
        <StatStrip cells={stripCells} className="mb-4" />
      )}

      <DirectiveFiltersBar value={filters} onChange={handleFiltersChange} availableYears={AVAILABLE_YEARS} />

      {directivesQuery.isLoading ? (
        <Spinner label="Chargement des directives…" />
      ) : directivesQuery.error ? (
        <ErrorBanner message="Impossible de charger les directives" />
      ) : directivesQuery.data ? (
        <DirectiveTable
          items={directivesQuery.data.items}
          totalCount={directivesQuery.data.totalCount}
          page={directivesQuery.data.page}
          pageSize={directivesQuery.data.pageSize}
          onPageChange={setPage}
          onRowClick={(d) => navigate(`/directives/${d.id}`)}
          selectable={isAdmin}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onDeleteRow={isAdmin ? (id) => setConfirmDelete({ kind: 'single', id }) : undefined}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && !deleting && setConfirmDelete(null)}
        title={
          confirmDelete?.kind === 'bulk'
            ? `Supprimer ${selectedIds.length} directive${selectedIds.length > 1 ? 's' : ''} ?`
            : 'Supprimer cette directive ?'
        }
        description={
          confirmDelete?.kind === 'bulk'
            ? `Les ${selectedIds.length} directives sélectionnées seront définitivement supprimées de la base. Cette action est irréversible — leur historique de commentaires sera aussi perdu.`
            : 'Cette directive sera définitivement supprimée de la base. Cette action est irréversible — son historique de commentaires sera aussi perdu.'
        }
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={() => handleConfirmDelete()}
      />
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-danger-bg border border-danger text-danger rounded-lg px-4 py-3 text-sm flex items-center gap-2.5">
      <XCircle className="w-4 h-4" strokeWidth={2} />
      {message}
    </div>
  );
}

// Helpers exportés pour les KPIs (réutilisables si besoin par le dashboard)
export const KPI_ICONS = { CheckCircle2, Clock, AlertTriangle };
