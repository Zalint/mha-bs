import {
  AlertTriangle,
  Archive,
  Ban,
  CheckCircle2,
  CheckSquare,
  Clock,
  Filter,
  Inbox,
  Plus,
  Search,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type { Directive, DirectiveEtat, PaginatedResponse } from '@mha-bs/shared';

import { Pagination } from '../../components/ui/Pagination.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { useApi } from '../../hooks/useApi.js';
import { ApiClientError, api } from '../../lib/apiClient.js';
import { cn } from '../../lib/cn.js';
import { daysBetween, todayYmd } from '../../lib/formatDate.js';

type Tab = 'ouvertes' | 'attente' | 'retard' | 'soumises' | 'cloturees' | 'ineligible';

const TAB_LABELS: Record<Tab, string> = {
  ouvertes: 'À traiter',
  attente: 'En attente',
  retard: 'En retard',
  soumises: 'Soumises au SG',
  cloturees: 'Clôturées',
  ineligible: 'Inéligibles',
};

const TAB_ICONS = {
  ouvertes: Inbox,
  attente: Clock,
  retard: AlertTriangle,
  soumises: CheckCircle2,
  cloturees: Archive,
  ineligible: Ban,
};

const TAB_ORDER: Tab[] = ['ouvertes', 'attente', 'retard', 'soumises', 'cloturees', 'ineligible'];

const PAGE_SIZE = 50;

const ETAT_OPTIONS: { value: DirectiveEtat; label: string }[] = [
  { value: 'attente', label: 'En attente' },
  { value: 'enCours', label: 'En cours' },
  { value: 'realisee', label: 'Réalisée' },
  { value: 'ineligible', label: 'Inéligible' },
];

const ETAT_STYLES: Record<DirectiveEtat, string> = {
  attente: 'bg-info-bg text-info',
  enCours: 'bg-warning-bg text-warning',
  realisee: 'bg-success-bg text-success',
  ineligible: 'bg-neutral-bg text-neutral',
};

export function BsListeView() {
  const navigate = useNavigate();
  const today = todayYmd();
  const [tab, setTab] = useState<Tab>('ouvertes');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const params = useMemo(() => {
    const base: Record<string, string | number | undefined> = {
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
    };
    if (tab === 'ouvertes') base.etat = 'enCours';
    if (tab === 'attente') base.etat = 'attente';
    if (tab === 'retard') base.etat = 'enCours'; // filtre côté client via échéance
    if (tab === 'cloturees') base.etat = 'realisee';
    if (tab === 'ineligible') base.etat = 'ineligible';
    if (tab === 'soumises') base.statutValidation = 'soumis';
    return base;
  }, [tab, search, page]);

  const query = useApi(
    () => api.get<PaginatedResponse<Directive>>('/directives', { query: params }),
    [tab, search, page],
  );

  useEffect(() => setSelected(new Set()), [tab, search, page]);

  const items = useMemo(() => {
    const all = query.data?.items ?? [];
    if (tab === 'retard') {
      return all.filter((d) => d.echeance !== null && d.echeance < today);
    }
    return all;
  }, [query.data, tab, today]);

  const counts = useMemo(() => {
    const all = query.data?.items ?? [];
    return {
      retard: all.filter((d) => d.echeance !== null && d.echeance < today && d.etat !== 'realisee').length,
      soumises: tab === 'soumises' ? all.length : 0,
    };
  }, [query.data, today, tab]);

  const handleStateChange = async (directive: Directive, newEtat: DirectiveEtat): Promise<void> => {
    try {
      await api.put(`/directives/${directive.id}`, { etat: newEtat });
      toast.success(`État mis à jour : ${ETAT_OPTIONS.find((o) => o.value === newEtat)?.label}`);
      query.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur');
    }
  };

  const handleEcheanceChange = async (directive: Directive, newEcheance: string): Promise<void> => {
    if (newEcheance && !/^\d{4}-\d{2}-\d{2}$/.test(newEcheance)) {
      toast.error('Format YYYY-MM-DD attendu');
      return;
    }
    try {
      await api.put(`/directives/${directive.id}`, { echeance: newEcheance || null });
      toast.success('Échéance mise à jour');
      query.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur');
    }
  };

  const toggleSelect = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (): void => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((d) => d.id)));
    }
  };

  const handleBulkRealisee = async (): Promise<void> => {
    const ids = Array.from(selected);
    try {
      await Promise.all(ids.map((id) => api.put(`/directives/${id}`, { etat: 'realisee' })));
      toast.success(`${ids.length} directive(s) marquée(s) Réalisée`);
      setSelected(new Set());
      query.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-3">
        <div>
          <h1 className="text-2xl font-semibold text-fg leading-tight">File de travail</h1>
          <p className="text-sm text-fg-muted mt-1">
            Directives à saisir, mettre à jour, ou faire valider
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary">
            <Filter className="w-3.5 h-3.5" /> Filtres avancés
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/bs/import')}>
            <Upload className="w-3.5 h-3.5" /> Importer
          </button>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/bs/fiche')}>
            <Plus className="w-3.5 h-3.5" /> Nouvelle directive
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="inline-flex gap-0.5 p-1 bg-muted border border-border rounded-lg">
          {TAB_ORDER.map((t) => {
            const Icon = TAB_ICONS[t];
            const isActive = tab === t;
            const count =
              t === 'retard' ? counts.retard : t === 'soumises' ? counts.soumises : null;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  isActive ? 'bg-surface text-fg shadow-sm' : 'text-fg-2 hover:text-fg',
                )}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.8} /> {TAB_LABELS[t]}
                {count !== null && (
                  <span
                    className={cn(
                      'text-[11px] px-1.5 py-0.5 rounded-full font-mono',
                      isActive ? 'bg-primary text-white' : 'bg-border text-fg-2',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="ml-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher dans la file…"
            className="input pl-9 w-[280px]"
          />
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="bg-primary-100 border border-primary rounded-lg px-4 py-2 mb-3 flex items-center gap-3 text-sm">
          <CheckSquare className="w-4 h-4 text-primary" />
          <span>
            <b className="text-primary-700">{selected.size}</b> sélectionnée(s)
          </span>
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => void handleBulkRealisee()}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Marquer Réalisée
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {query.isLoading ? (
          <Spinner label="Chargement…" />
        ) : query.error ? (
          <div className="text-danger text-sm p-6">Erreur de chargement.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="bg-surface2">
                <tr>
                  <th className="px-3 py-2.5 w-10 border-b border-border">
                    <input
                      type="checkbox"
                      aria-label="Tout sélectionner"
                      onChange={toggleSelectAll}
                      checked={selected.size > 0 && selected.size === items.length}
                      className="accent-primary"
                    />
                  </th>
                  <th className="text-left px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border w-24">
                    Code
                  </th>
                  <th className="text-left px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border">
                    Directive
                  </th>
                  <th className="text-left px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border w-32">
                    Échéance
                  </th>
                  <th className="text-left px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border w-36">
                    État
                  </th>
                  <th className="text-right px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border w-24">
                    Retard
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-fg-muted py-12 text-sm">
                      <Inbox className="w-8 h-8 mx-auto mb-2 text-fg-muted" strokeWidth={1.5} />
                      Aucune directive dans cette vue.
                    </td>
                  </tr>
                ) : (
                  items.map((d) => {
                    const isLate =
                      d.echeance !== null && d.echeance < today && d.etat !== 'realisee';
                    const retard = isLate && d.echeance ? daysBetween(d.echeance, today) : null;
                    return (
                      <tr
                        key={d.id}
                        className={cn(
                          'border-b border-border last:border-0 hover:bg-muted',
                          isLate && 'bg-danger-bg/30',
                        )}
                      >
                        <td className="px-3 py-3 align-top">
                          <input
                            type="checkbox"
                            aria-label="Sélectionner"
                            checked={selected.has(d.id)}
                            onChange={() => toggleSelect(d.id)}
                            className="accent-primary"
                          />
                        </td>
                        <td
                          className="px-3 py-3 align-top cursor-pointer"
                          onClick={() => navigate(`/bs/fiche/${d.id}`)}
                        >
                          <span className="font-mono text-xs">{d.codeDirective}</span>
                        </td>
                        <td
                          className="px-3 py-3 max-w-[480px] cursor-pointer"
                          onClick={() => navigate(`/bs/fiche/${d.id}`)}
                        >
                          <div className="line-clamp-2 leading-snug">{d.texteDirective}</div>
                          {d.ministeresAssocies.length > 0 && (
                            <div className="text-[11.5px] text-fg-muted font-mono mt-1">
                              {d.ministeresAssocies.join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="date"
                            value={d.echeance ?? ''}
                            onChange={(e) => void handleEcheanceChange(d, e.target.value)}
                            className="bg-transparent border border-transparent hover:border-border hover:bg-surface focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 rounded px-2 py-1 text-xs font-mono w-32"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={d.etat}
                            onChange={(e) => void handleStateChange(d, e.target.value as DirectiveEtat)}
                            className={cn(
                              'text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30',
                              ETAT_STYLES[d.etat],
                            )}
                          >
                            {ETAT_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {retard !== null ? (
                            <span className="font-mono text-danger font-semibold">+{retard} j</span>
                          ) : (
                            <span className="text-fg-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {query.data && (
          <Pagination
            page={query.data.page}
            pageSize={query.data.pageSize}
            totalCount={query.data.totalCount}
            onPageChange={setPage}
          />
        )}
      </div>

      <p className="mt-3 text-xs text-fg-muted">
        Astuce : cliquez sur une ligne pour ouvrir la fiche complète. L'état et l'échéance se mettent à
        jour immédiatement au changement, avec sauvegarde automatique.
      </p>
    </div>
  );
}
