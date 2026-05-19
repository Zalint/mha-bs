import { ClipboardList, Droplets, Edit3, Landmark } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type { RecommandationMatrice } from '@mha-bs/shared';

import { Spinner } from '../../components/ui/Spinner.js';
import { StateBadge } from '../../components/ui/StateBadge.js';
import { useApi } from '../../hooks/useApi.js';
import { api } from '../../lib/apiClient.js';
import { cn } from '../../lib/cn.js';

type Pane = 'ref-ass' | 'ref-inst';

const Q_TITLES: Record<'T1' | 'T2' | 'T3' | 'T4', string> = {
  T1: 'Janvier–Mars',
  T2: 'Avril–Juin',
  T3: 'Juillet–Sept.',
  T4: 'Octobre–Déc.',
};

export function ReformesView() {
  const [pane, setPane] = useState<Pane>('ref-ass');
  const query = useApi(() => api.get<{ items: RecommandationMatrice[] }>('/matrices'), []);

  const reformeAss = useMemo(
    () =>
      (query.data?.items ?? [])
        .filter((r) => r.typeMatrice === 'reformeAssainissement')
        .sort((a, b) => a.numOrdre - b.numOrdre),
    [query.data],
  );

  const reformeInst = useMemo(
    () =>
      (query.data?.items ?? [])
        .filter((r) => r.typeMatrice === 'reformeInstitutionnelle')
        .sort((a, b) => a.numOrdre - b.numOrdre),
    [query.data],
  );

  const statsAss = useMemo(() => statsOf(reformeAss), [reformeAss]);

  if (query.isLoading) return <Spinner label="Chargement des réformes…" />;
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
      <h1 className="text-2xl font-semibold text-fg leading-tight">Réformes</h1>
      <p className="text-sm text-fg-muted mt-1 mb-5">
        Suivi des réformes du secteur Eau-Assainissement : Code de l'Assainissement et réforme
        institutionnelle (ARSE, DSP)
      </p>

      {/* Tabs */}
      <div className="inline-flex gap-1 p-1 bg-muted border border-border rounded-lg mb-4">
        <TabButton
          active={pane === 'ref-ass'}
          onClick={() => setPane('ref-ass')}
          icon={Droplets}
          label="Réforme Assainissement"
          count={reformeAss.length}
        />
        <TabButton
          active={pane === 'ref-inst'}
          onClick={() => setPane('ref-inst')}
          icon={Landmark}
          label="Réforme Institutionnelle"
          count={reformeInst.length}
        />
      </div>

      {pane === 'ref-ass' && (
        <>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-5">
            <div className="card p-5">
              <div className="text-xs text-fg-muted uppercase tracking-wider font-medium">Recommandations</div>
              <div className="font-mono text-3xl font-bold text-fg mt-1">{reformeAss.length}</div>
              <div className="flex h-2 bg-muted rounded-full mt-3.5 overflow-hidden">
                <div className="bg-success" style={{ width: `${(statsAss.realisees / reformeAss.length) * 100 || 0}%` }} />
                <div className="bg-warning" style={{ width: `${(statsAss.enCours / reformeAss.length) * 100 || 0}%` }} />
                <div className="bg-primary" style={{ width: `${(statsAss.attente / reformeAss.length) * 100 || 0}%` }} />
              </div>
              <div className="flex justify-between mt-1.5 text-[11.5px] text-fg-muted">
                <span>{statsAss.realisees} réalisée(s)</span>
                <span>{statsAss.enCours} en cours</span>
                <span>{statsAss.attente} en attente</span>
              </div>
            </div>
            <div className="card p-5">
              <div className="text-xs text-fg-muted uppercase tracking-wider font-medium">Cadre légal cible</div>
              <div className="text-md font-semibold text-fg mt-1">Code de l'Assainissement</div>
              <div className="text-xs text-fg-muted mt-1.5">Création d'un Fonds d'Assainissement</div>
            </div>
            <div className="card p-5">
              <div className="text-xs text-fg-muted uppercase tracking-wider font-medium">Acteurs clés</div>
              <div className="font-mono text-3xl font-bold text-fg mt-1">5</div>
              <div className="text-xs text-fg-muted mt-1.5">ONAS · DA · DPGI · CPCSP · Min. Emploi</div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="card-header">
              <div>
                <h2 className="text-md font-semibold">Matrice de suivi · Réforme de l'assainissement</h2>
                <p className="text-xs text-fg-muted mt-0.5">{reformeAss.length} recommandations stratégiques</p>
              </div>
              <div className="ml-auto">
                <Link to="/bs/matrice" className="btn btn-secondary btn-sm">
                  <Edit3 className="w-3 h-3" /> Mettre à jour
                </Link>
              </div>
            </div>
            <RecoList items={reformeAss} />
          </div>
        </>
      )}

      {pane === 'ref-inst' && (
        <>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-5">
            <div className="card p-5">
              <div className="text-xs text-fg-muted uppercase tracking-wider font-medium">Activités planifiées</div>
              <div className="font-mono text-3xl font-bold text-fg mt-1">{reformeInst.length}</div>
              <div className="text-xs text-fg-muted mt-1.5">Réparties sur 4 trimestres</div>
            </div>
            <div className="card p-5">
              <div className="text-xs text-fg-muted uppercase tracking-wider font-medium">Échéance finale</div>
              <div className="text-md font-semibold text-primary mt-1">T4 2026</div>
              <div className="text-xs text-fg-muted mt-1.5">Déploiement opérationnel de l'ARSE</div>
            </div>
            <div className="card p-5">
              <div className="text-xs text-fg-muted uppercase tracking-wider font-medium">Priorité dominante</div>
              <div className="text-md font-semibold text-warning mt-1">Prioritaire</div>
              <div className="text-xs text-fg-muted mt-1.5">Mix d'urgent et prioritaire</div>
            </div>
          </div>

          <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-3">
            Feuille de route trimestrielle · 2026
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {(['T1', 'T2', 'T3', 'T4'] as const).map((q) => {
              const qActs = reformeInst.filter((r) => r.echeanceTrimestre === q);
              return (
                <div key={q} className="card p-3.5 min-h-[240px]">
                  <div className="flex justify-between items-center pb-2.5 border-b-2 border-primary mb-3">
                    <h3 className="font-mono font-bold">
                      {q}{' '}
                      <span className="text-xs font-normal text-fg-muted">· {Q_TITLES[q]}</span>
                    </h3>
                  </div>
                  {qActs.length === 0 ? (
                    <div className="text-xs text-fg-muted text-center py-6">Aucune activité</div>
                  ) : (
                    qActs.map((a) => (
                      <div
                        key={a.id}
                        className={cn(
                          'rounded p-2.5 mb-2 text-xs leading-relaxed border-l-[3px]',
                          a.priorite === 'urgent' && 'bg-danger-bg border-l-danger',
                          a.priorite === 'prioritaire' && 'bg-warning-bg border-l-warning',
                          (a.priorite === 'obligatoire' || a.priorite === 'standard' || !a.priorite) &&
                            'bg-muted border-l-primary',
                        )}
                      >
                        <div
                          className={cn(
                            'text-[10.5px] uppercase tracking-wider font-semibold mb-1',
                            a.priorite === 'urgent' && 'text-danger',
                            a.priorite === 'prioritaire' && 'text-warning',
                            (a.priorite === 'obligatoire' || a.priorite === 'standard' || !a.priorite) &&
                              'text-fg-muted',
                          )}
                        >
                          {a.priorite ?? 'standard'}
                        </div>
                        <div className="text-fg-2">{a.texteRecommandation.slice(0, 140)}</div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Droplets;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2',
        active ? 'bg-surface text-fg shadow-sm' : 'text-fg-2 hover:text-fg',
      )}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
      <span
        className={cn(
          'text-[11px] px-1.5 py-0.5 rounded-full font-mono ml-1',
          active ? 'bg-primary text-white' : 'bg-border text-fg-2',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function RecoList({ items }: { items: RecommandationMatrice[] }) {
  if (items.length === 0) {
    return <div className="text-center text-fg-muted py-10 text-sm">Aucune recommandation.</div>;
  }
  return (
    <div>
      {items.map((r) => (
        <div
          key={r.id}
          className="grid grid-cols-[36px_1fr_150px] gap-3.5 px-5 py-3.5 border-b border-border last:border-0 hover:bg-muted items-center"
        >
          <div className="w-7 h-7 rounded bg-primary-100 text-primary font-mono font-semibold text-xs flex items-center justify-center">
            {r.numOrdre}
          </div>
          <div className="text-sm leading-relaxed text-fg-2">{r.texteRecommandation}</div>
          <div>
            <StateBadge etat={r.etat} />
          </div>
        </div>
      ))}
    </div>
  );
}

function statsOf(items: RecommandationMatrice[]) {
  return {
    realisees: items.filter((r) => r.etat === 'realisee').length,
    enCours: items.filter((r) => r.etat === 'enCours').length,
    attente: items.filter((r) => r.etat === 'attente').length,
  };
}
