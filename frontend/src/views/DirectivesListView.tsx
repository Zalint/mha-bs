import { AlertTriangle, CheckCircle2, Clock, Download, Plus, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { PaginatedResponse, Directive, TypeRencontre } from '@mha-bs/shared';

import { DirectiveFiltersBar, type DirectiveFiltersValue } from '../components/directives/DirectiveFilters.js';
import { DirectiveTable } from '../components/directives/DirectiveTable.js';
import { Spinner } from '../components/ui/Spinner.js';
import { StatStrip, type StatCell } from '../components/ui/StatStrip.js';
import { useApi } from '../hooks/useApi.js';
import { api } from '../lib/apiClient.js';

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
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<DirectiveFiltersValue>({ annee: '', etat: '', search: '' });

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

  return (
    <div>
      <div className="flex flex-wrap items-end justify-end gap-2 mb-3">
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
        />
      ) : null}
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
