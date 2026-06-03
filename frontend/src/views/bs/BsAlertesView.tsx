import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Spinner } from '../../components/ui/Spinner.js';
import { useApi } from '../../hooks/useApi.js';
import { ApiClientError, api } from '../../lib/apiClient.js';
import { cn } from '../../lib/cn.js';
import { formatShort } from '../../lib/formatDate.js';

type Categorie = 'critique' | 'warning' | 'info';

interface Alerte {
  id: string;
  categorie: Categorie;
  titre: string;
  description: string | null;
  sourceEntiteType: string | null;
  sourceEntiteId: string | null;
  lue: boolean;
  createdAt: string;
}

type Filter = 'toutes' | 'non-lues' | 'critique' | 'warning' | 'info';

const CATEGORIE_STYLES: Record<Categorie, { bg: string; text: string; border: string; icon: typeof Bell }> = {
  critique: { bg: 'bg-danger-bg', text: 'text-danger', border: 'border-danger/40', icon: AlertTriangle },
  warning: { bg: 'bg-warning-bg', text: 'text-warning', border: 'border-warning/40', icon: AlertTriangle },
  info: { bg: 'bg-info-bg', text: 'text-primary', border: 'border-primary/40', icon: Info },
};

const CATEGORIE_LABELS: Record<Categorie, string> = {
  critique: 'Critique',
  warning: 'Alerte',
  info: 'Info',
};

export function BsAlertesView() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('non-lues');
  const [generating, setGenerating] = useState(false);

  const query = useApi(
    () => api.get<{ items: Alerte[]; unread: number }>('/alertes'),
    [],
  );

  const items = query.data?.items ?? [];
  const unread = query.data?.unread ?? 0;

  const filtered = useMemo(() => {
    if (filter === 'toutes') return items;
    if (filter === 'non-lues') return items.filter((a) => !a.lue);
    return items.filter((a) => a.categorie === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    return {
      toutes: items.length,
      'non-lues': items.filter((a) => !a.lue).length,
      critique: items.filter((a) => a.categorie === 'critique').length,
      warning: items.filter((a) => a.categorie === 'warning').length,
      info: items.filter((a) => a.categorie === 'info').length,
    } satisfies Record<Filter, number>;
  }, [items]);

  const handleMarkRead = async (id: string): Promise<void> => {
    try {
      await api.patch(`/alertes/${id}/lue`);
      query.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur');
    }
  };

  const handleMarkAllRead = async (): Promise<void> => {
    try {
      const res = await api.patch<{ updated: number }>('/alertes/tout-lu');
      toast.success(`${res.updated} alerte${res.updated > 1 ? 's' : ''} marquée${res.updated > 1 ? 's' : ''} comme lue${res.updated > 1 ? 's' : ''}`);
      query.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur');
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    try {
      await api.delete(`/alertes/${id}`);
      query.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur');
    }
  };

  const handleGenerate = async (): Promise<void> => {
    setGenerating(true);
    try {
      const res = await api.post<{ total: number }>('/alertes/generer');
      if (res.total === 0) {
        toast.info('Aucune nouvelle alerte à générer (déjà à jour).');
      } else {
        toast.success(`${res.total} nouvelle${res.total > 1 ? 's' : ''} alerte${res.total > 1 ? 's' : ''} générée${res.total > 1 ? 's' : ''}`);
      }
      query.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur');
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenSource = (alerte: Alerte): void => {
    if (!alerte.sourceEntiteType || !alerte.sourceEntiteId) return;
    switch (alerte.sourceEntiteType) {
      case 'directive':
        navigate(`/bs/fiche/${alerte.sourceEntiteId}`);
        break;
      case 'recommandation':
        navigate('/bs/matrice');
        break;
      case 'copilProjet':
        navigate(`/recommandations/copil?projet=${alerte.sourceEntiteId}`);
        break;
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-fg leading-tight flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-primary" strokeWidth={1.8} />
            Mes alertes
            {unread > 0 && (
              <span className="text-sm font-mono bg-danger text-white px-2 py-0.5 rounded-full">
                {unread} non-lue{unread > 1 ? 's' : ''}
              </span>
            )}
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            Notifications sur les directives en retard, projets COPIL sous objectif,
            recommandations en attente longue durée.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating}
            className="btn btn-secondary"
            title="Re-scanne la base et crée les alertes manquantes (idempotent)"
          >
            {generating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {generating ? 'Génération…' : 'Générer'}
          </button>
          <button
            type="button"
            onClick={() => void handleMarkAllRead()}
            disabled={counts['non-lues'] === 0}
            className="btn btn-secondary"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Tout marquer lu
          </button>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="btn btn-ghost"
            aria-label="Rafraîchir"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-1 p-1 bg-muted border border-border rounded-lg mb-4">
        {(
          [
            { value: 'non-lues' as Filter, label: 'Non-lues' },
            { value: 'toutes' as Filter, label: 'Toutes' },
            { value: 'critique' as Filter, label: 'Critiques' },
            { value: 'warning' as Filter, label: 'Alertes' },
            { value: 'info' as Filter, label: 'Info' },
          ]
        ).map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setFilter(t.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5',
              filter === t.value
                ? 'bg-surface text-fg shadow-sm'
                : 'text-fg-2 hover:text-fg',
            )}
          >
            {t.label}
            <span className="font-mono text-[10.5px] bg-border text-fg-2 px-1.5 py-0.5 rounded-full">
              {counts[t.value]}
            </span>
          </button>
        ))}
      </div>

      {/* Liste */}
      {query.isLoading ? (
        <Spinner label="Chargement…" />
      ) : query.error ? (
        <div className="bg-danger-bg border border-danger text-danger rounded-lg px-4 py-3 text-sm">
          Erreur de chargement.
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg py-12 text-center">
          <Bell className="w-10 h-10 mx-auto text-fg-muted mb-3" strokeWidth={1.5} />
          <p className="text-sm text-fg-muted">
            {filter === 'non-lues'
              ? "Aucune alerte non-lue. Tout est sous contrôle."
              : 'Aucune alerte dans cette vue.'}
          </p>
          {items.length === 0 && (
            <p className="text-xs text-fg-muted mt-2 italic">
              Click <b>« Générer »</b> pour scanner la base et créer des alertes
              automatiques (directives en retard, COPIL sous objectif, …).
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const style = CATEGORIE_STYLES[a.categorie];
            const Icon = style.icon;
            return (
              <div
                key={a.id}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-lg border transition-all',
                  a.lue ? 'bg-surface border-border opacity-70' : `${style.bg} ${style.border}`,
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                    style.bg,
                    style.text,
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className={cn('font-semibold text-sm', style.text)}>{a.titre}</h3>
                    <span className="text-[10.5px] uppercase tracking-wider font-bold text-fg-muted">
                      {CATEGORIE_LABELS[a.categorie]}
                    </span>
                    <span className="text-[10.5px] text-fg-muted font-mono">
                      {formatShort(a.createdAt.slice(0, 10))}
                    </span>
                  </div>
                  {a.description && (
                    <p className="text-xs text-fg-2 mt-1 leading-relaxed">{a.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {a.sourceEntiteType && a.sourceEntiteId && (
                      <button
                        type="button"
                        onClick={() => handleOpenSource(a)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Ouvrir la source →
                      </button>
                    )}
                    {!a.lue && (
                      <button
                        type="button"
                        onClick={() => void handleMarkRead(a.id)}
                        className="text-xs text-fg-muted hover:text-fg"
                      >
                        Marquer lue
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDelete(a.id)}
                      className="text-xs text-fg-muted hover:text-danger inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Supprimer
                    </button>
                  </div>
                </div>
                {a.lue && (
                  <span className="text-[10px] text-fg-muted self-start flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> lue
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
