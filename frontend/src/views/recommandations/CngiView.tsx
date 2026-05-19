import { AlertTriangle, ClipboardList, CloudRain, Edit3, Users } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import type { RecommandationMatrice } from '@mha-bs/shared';

import { Spinner } from '../../components/ui/Spinner.js';
import { StateBadge } from '../../components/ui/StateBadge.js';
import { useApi } from '../../hooks/useApi.js';
import { api } from '../../lib/apiClient.js';

export function CngiView() {
  const query = useApi(() => api.get<{ items: RecommandationMatrice[] }>('/matrices/cngi'), []);

  const items = useMemo(
    () => (query.data?.items ?? []).slice().sort((a, b) => a.numOrdre - b.numOrdre),
    [query.data],
  );

  const stats = useMemo(() => {
    const total = items.length || 1;
    const realisees = items.filter((r) => r.etat === 'realisee').length;
    const enCours = items.filter((r) => r.etat === 'enCours').length;
    const attente = items.filter((r) => r.etat === 'attente').length;
    return {
      total: items.length,
      realisees,
      enCours,
      attente,
      pctRealisees: (realisees / total) * 100,
      pctEnCours: (enCours / total) * 100,
      pctAttente: (attente / total) * 100,
    };
  }, [items]);

  if (query.isLoading) return <Spinner label="Chargement du CNGI…" />;
  if (query.error) {
    return (
      <div className="bg-danger-bg border border-danger text-danger rounded-lg px-4 py-3 text-sm">
        Erreur de chargement.
      </div>
    );
  }

  return (
    <div>
      <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-primary-100 text-primary-700 rounded text-[11.5px] font-semibold uppercase tracking-wider mb-2">
        <ClipboardList className="w-3.5 h-3.5" /> Recommandations MHA
      </div>
      <h1 className="text-2xl font-semibold text-fg leading-tight">CNGI</h1>
      <p className="text-sm text-fg-muted mt-1 mb-5">
        Comité national de Gestion Intégrée du Risque d'Inondations · session d'avril 2026 ·
        préparation de l'hivernage 2026
      </p>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-5">
        <div className="card p-5">
          <div className="text-xs text-fg-muted uppercase tracking-wider font-medium flex items-center gap-1.5">
            <CloudRain className="w-3.5 h-3.5" /> Recommandations CNGI
          </div>
          <div className="font-mono text-3xl font-bold text-fg mt-1">{stats.total}</div>
          <div className="flex h-2 bg-muted rounded-full mt-3.5 overflow-hidden">
            <div className="bg-success" style={{ width: `${stats.pctRealisees}%` }} />
            <div className="bg-warning" style={{ width: `${stats.pctEnCours}%` }} />
            <div className="bg-primary" style={{ width: `${stats.pctAttente}%` }} />
          </div>
          <div className="flex justify-between mt-1.5 text-[11.5px] text-fg-muted">
            <span>{stats.realisees} réalisée(s)</span>
            <span>{stats.enCours} en cours</span>
            <span>{stats.attente} en attente</span>
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-fg-muted uppercase tracking-wider font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Échéance critique
          </div>
          <div className="text-md font-semibold text-danger mt-1">Fin juin 2026</div>
          <div className="text-xs text-fg-muted mt-1.5">
            Curage de canaux, faucardage, équipements de pompage
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-fg-muted uppercase tracking-wider font-medium flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Structures mobilisées
          </div>
          <div className="font-mono text-3xl font-bold text-fg mt-1">8</div>
          <div className="text-xs text-fg-muted mt-1.5 leading-relaxed">
            DPGI · ONAS · AGEROUTE · BNSP · Génie militaire · ADM · PROMOVILLE · APIX
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header">
          <div>
            <h2 className="text-md font-semibold">Recommandations CNGI · Avril 2026</h2>
            <p className="text-xs text-fg-muted mt-0.5">Pour la préparation de l'hivernage 2026</p>
          </div>
          <div className="ml-auto">
            <Link to="/bs/matrice" className="btn btn-secondary btn-sm">
              <Edit3 className="w-3 h-3" /> Mettre à jour
            </Link>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="text-center text-fg-muted py-12 text-sm">Aucune recommandation en base.</div>
        ) : (
          items.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[36px_1fr_140px_150px] gap-3.5 px-5 py-3.5 border-b border-border last:border-0 hover:bg-muted items-center"
            >
              <div className="w-7 h-7 rounded bg-primary-100 text-primary font-mono font-semibold text-xs flex items-center justify-center">
                {r.numOrdre}
              </div>
              <div className="text-sm leading-relaxed text-fg-2">
                {r.texteRecommandation.slice(0, 240)}
                {r.texteRecommandation.length > 240 ? '…' : ''}
              </div>
              <div className="text-xs text-fg-muted">DPGI · ONAS</div>
              <div>
                <StateBadge etat={r.etat} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
