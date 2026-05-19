import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { Rencontre, TypeRencontre } from '@mha-bs/shared';

import { NewRencontreModal } from '../../components/directives/NewRencontreModal.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { useApi } from '../../hooks/useApi.js';
import { api } from '../../lib/apiClient.js';
import { formatShort } from '../../lib/formatDate.js';

const TYPE_LABELS: Record<string, string> = {
  conseilMinistres: 'Conseil des ministres',
  conseilInterMinisteriel: 'Conseil inter-ministériel',
  coordinationSggSg: 'Coordination SGG/SG',
  copil: 'COPIL',
  cngi: 'CNGI',
  reunionTechnique: 'Réunion technique',
  commissionAn: 'Commission AN',
};

const TYPE_BADGE_STYLES: Record<string, string> = {
  conseilMinistres: 'bg-info-bg text-info',
  conseilInterMinisteriel: 'bg-success-bg text-success',
  coordinationSggSg: 'bg-warning-bg text-warning',
  copil: 'bg-primary-100 text-primary-700',
  cngi: 'bg-danger-bg text-danger',
  reunionTechnique: 'bg-neutral-bg text-neutral',
  commissionAn: 'bg-muted text-fg-2',
};

export function BsRencontreView() {
  const [open, setOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeRencontre | ''>('');
  const [search, setSearch] = useState('');

  const query = useApi(() => api.get<{ items: Rencontre[] }>('/rencontres'), []);

  const items = useMemo(() => {
    const all = query.data?.items ?? [];
    let filtered = typeFilter ? all.filter((r) => r.typeRencontre === typeFilter) : all;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.codeRencontre.toLowerCase().includes(q) ||
          r.intitule.toLowerCase().includes(q) ||
          r.dateRencontre.includes(q),
      );
    }
    return filtered;
  }, [query.data, typeFilter, search]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-3">
        <div>
          <h1 className="text-2xl font-semibold text-fg leading-tight">Nouvelle rencontre</h1>
          <p className="text-sm text-fg-muted mt-1">
            Conseils des ministres, conseils inter-ministériels, coordinations SGG/SG, COPIL, CNGI,
            commissions Assemblée Nationale. Chaque rencontre peut accueillir plusieurs directives.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          <Plus className="w-3.5 h-3.5" /> Créer une rencontre
        </button>
      </div>

      <div className="bg-surface border border-border rounded-lg p-4 mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="f-type" className="field-label">
            Filtrer par type
          </label>
          <select
            id="f-type"
            className="select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeRencontre | '')}
          >
            <option value="">Tous</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[240px]">
          <label htmlFor="f-search" className="field-label">
            Recherche
          </label>
          <input
            id="f-search"
            type="text"
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="code, intitulé ou date…"
          />
        </div>
        <div className="ml-auto text-sm text-fg-muted">
          <b className="text-fg font-mono">{items.length}</b> rencontre(s)
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {query.isLoading ? (
          <Spinner label="Chargement des rencontres…" />
        ) : query.error ? (
          <div className="text-danger text-sm p-6">Erreur de chargement.</div>
        ) : items.length === 0 ? (
          <div className="text-fg-muted text-sm text-center py-12">
            Aucune rencontre ne correspond aux critères.
          </div>
        ) : (
          <div className="overflow-auto max-h-[640px]">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="bg-surface2 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border w-32">
                    Code
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border w-44">
                    Type
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border">
                    Intitulé
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border w-28">
                    Date
                  </th>
                  <th className="text-right px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border w-20">
                    Année
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted">
                    <td className="px-4 py-3 font-mono text-xs">{r.codeRencontre}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${TYPE_BADGE_STYLES[r.typeRencontre]}`}>
                        {TYPE_LABELS[r.typeRencontre]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-fg-2">{r.intitule}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatShort(r.dateRencontre)}</td>
                    <td className="px-4 py-3 font-mono text-right text-fg-muted">{r.annee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewRencontreModal
        open={open}
        onOpenChange={setOpen}
        onCreated={(r) => {
          toast.success(`Rencontre ${r.codeRencontre} créée`);
          query.refetch();
        }}
      />
    </div>
  );
}
