import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type { Directive, PaginatedResponse } from '@mha-bs/shared';

import { Spinner } from '../../components/ui/Spinner.js';
import { useApi } from '../../hooks/useApi.js';
import { ApiClientError, api } from '../../lib/apiClient.js';
import { cn } from '../../lib/cn.js';
import { formatShort } from '../../lib/formatDate.js';

const TYPE_RENCONTRE_LABELS: Record<string, string> = {
  conseilMinistres: 'Conseil des ministres',
  conseilInterMinisteriel: 'Conseil inter-ministériel',
  coordinationSggSg: 'Coordination SGG/SG',
};

const ETAT_LABELS: Record<string, string> = {
  attente: 'En attente',
  enCours: 'En cours',
  realisee: 'Réalisée',
  ineligible: 'Inéligible',
};

const ETAT_STYLES: Record<string, string> = {
  attente: 'bg-info-bg text-info',
  enCours: 'bg-warning-bg text-warning',
  realisee: 'bg-success-bg text-success',
  ineligible: 'bg-neutral-bg text-neutral',
};

export function SgValidationView() {
  const navigate = useNavigate();

  const query = useApi(
    () =>
      api.get<PaginatedResponse<Directive>>('/directives', {
        query: { statutValidation: 'soumis', pageSize: 200 },
      }),
    [],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const handleValider = async (id: string): Promise<void> => {
    try {
      await api.post(`/directives/${id}/valider`);
      toast.success('Directive validée');
      query.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-success-bg text-success rounded text-[11.5px] font-semibold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5" /> Action SG requise
          </div>
          <h1 className="text-2xl font-semibold text-fg leading-tight">Validation des directives</h1>
          <p className="text-sm text-fg-muted mt-1">
            Directives soumises par le Bureau de Suivi en attente de votre validation.
          </p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="bg-surface2 px-4 py-3 border-b border-border flex items-center">
          <h2 className="text-md font-semibold">À valider</h2>
          <span className="ml-2 text-sm text-fg-muted font-mono">{items.length}</span>
        </div>
        {query.isLoading ? (
          <Spinner label="Chargement..." />
        ) : items.length === 0 ? (
          <div className="text-center text-fg-muted py-12 text-sm">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success" strokeWidth={1.5} />
            Aucune directive en attente de validation.
          </div>
        ) : (
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="bg-surface2">
              <tr>
                <Th className="w-32">Code</Th>
                <Th className="w-40">Type rencontre</Th>
                <Th>Directive</Th>
                <Th className="w-32">Échéance</Th>
                <Th className="w-28 text-center">État</Th>
                <Th className="w-36 text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted">
                  <td
                    className="px-3 py-3 font-mono text-xs cursor-pointer"
                    onClick={() => navigate(`/directives/${d.id}`)}
                  >
                    {d.codeDirective}
                  </td>
                  <td className="px-3 py-3 text-xs text-fg-2">
                    {/* le filter typeRencontre n'est pas dans directiveSchema mais peut etre presente */}
                    {(d as Directive & { typeRencontre?: string }).typeRencontre
                      ? TYPE_RENCONTRE_LABELS[(d as Directive & { typeRencontre: string }).typeRencontre] ??
                        (d as Directive & { typeRencontre: string }).typeRencontre
                      : '—'}
                  </td>
                  <td
                    className="px-3 py-3 max-w-[520px] cursor-pointer"
                    onClick={() => navigate(`/directives/${d.id}`)}
                  >
                    <div className="line-clamp-2 leading-snug">{d.texteDirective}</div>
                    {d.ministeresAssocies.length > 0 && (
                      <div className="text-[11.5px] text-fg-muted font-mono mt-1">
                        {d.ministeresAssocies.join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{formatShort(d.echeance)}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={cn('badge', ETAT_STYLES[d.etat])}>{ETAT_LABELS[d.etat]}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-ghost text-xs px-2 py-1"
                        onClick={() => navigate(`/directives/${d.id}`)}
                      >
                        Voir
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary text-xs px-2.5 py-1"
                        onClick={() => void handleValider(d.id)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Valider
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'text-left px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border',
        className,
      )}
    >
      {children}
    </th>
  );
}
