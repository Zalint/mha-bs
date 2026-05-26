import { AlertTriangle, CheckCircle2, ClipboardList, Clock, FolderKanban } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { RecommandationMatrice } from '@mha-bs/shared';

import { KpiCard } from '../../components/ui/KpiCard.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { useApi } from '../../hooks/useApi.js';
import { useReferentiel } from '../../hooks/useReferentiel.js';
import { api } from '../../lib/apiClient.js';
import { cn } from '../../lib/cn.js';

/**
 * Vue unique pour TOUTES les catégories de matrices.
 * Liste les matrices rattachées à la catégorie active (via parentCode), avec
 * leurs KPIs et un aperçu des recommandations. Aucune liste hardcodée — tout
 * est piloté par les référentiels `matriceCategorie` et `typeMatrice`.
 */
export function CategorieMatricesView() {
  const { categorie } = useParams<{ categorie: string }>();
  const matriceRef = useReferentiel('typeMatrice');
  const categories = useReferentiel('matriceCategorie');
  const allQuery = useApi(() => api.get<{ items: RecommandationMatrice[] }>('/matrices'), []);

  const categoryLabel = useMemo(
    () => categories.items.find((c) => c.code === categorie)?.label ?? categorie ?? '—',
    [categories.items, categorie],
  );

  // Matrices rattachées à cette catégorie. Pour 'autres', on inclut aussi les
  // matrices SANS parentCode (rétro-compat : matrices anciennes pas encore mappées).
  const matricesInCategory = useMemo(() => {
    return matriceRef.items.filter((m) => {
      if (categorie === 'autres') {
        return m.parentCode === 'autres' || m.parentCode === null;
      }
      return m.parentCode === categorie;
    });
  }, [matriceRef.items, categorie]);

  // Recommandations groupées par matrice + KPIs agrégés
  const { byMatrice, kpis } = useMemo(() => {
    const map: Record<string, RecommandationMatrice[]> = {};
    let total = 0;
    let realisees = 0;
    let enCours = 0;
    let attente = 0;
    const matriceCodes = new Set(matricesInCategory.map((m) => m.code));

    for (const r of allQuery.data?.items ?? []) {
      if (!matriceCodes.has(r.typeMatrice)) continue;
      if (!map[r.typeMatrice]) map[r.typeMatrice] = [];
      map[r.typeMatrice].push(r);
      total++;
      if (r.etat === 'realisee') realisees++;
      else if (r.etat === 'enCours') enCours++;
      else if (r.etat === 'attente') attente++;
    }
    return {
      byMatrice: map,
      kpis: {
        total,
        realisees,
        enCours,
        attente,
        pctReal: total > 0 ? Math.round((realisees / total) * 100) : 0,
      },
    };
  }, [matricesInCategory, allQuery.data]);

  if (matriceRef.isLoading || allQuery.isLoading) {
    return <Spinner label="Chargement…" />;
  }

  if (matricesInCategory.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center">
        <FolderKanban className="w-10 h-10 text-fg-muted mx-auto mb-3" strokeWidth={1.5} />
        <h2 className="text-base font-semibold mb-1">Aucune matrice dans &laquo;&nbsp;{categoryLabel}&nbsp;&raquo;</h2>
        <p className="text-sm text-fg-muted">
          Aucune matrice n&apos;est rattachée à cette catégorie pour l&apos;instant. Va dans{' '}
          <Link to="/bs/matrice" className="text-primary hover:underline">
            Saisie matrices
          </Link>{' '}
          pour déplacer une matrice dans cette catégorie, ou dans{' '}
          <Link to="/bs/config" className="text-primary hover:underline">
            Configuration
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* KPIs aggrégés sur la catégorie */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-5">
        <KpiCard
          label="Matrices suivies"
          value={matricesInCategory.length}
          delta={categoryLabel}
          icon={FolderKanban}
        />
        <KpiCard
          label="Recommandations"
          value={kpis.total}
          delta={`${kpis.pctReal}% réalisé`}
          icon={ClipboardList}
        />
        <KpiCard
          label="En cours"
          value={kpis.enCours}
          delta={kpis.attente > 0 ? `+ ${kpis.attente} en attente` : 'aucune en attente'}
          icon={Clock}
          variant="warning"
        />
        <KpiCard
          label="Réalisées"
          value={kpis.realisees}
          delta={kpis.total > 0 ? `${kpis.realisees}/${kpis.total}` : '0/0'}
          icon={CheckCircle2}
          variant="success"
        />
      </div>

      {/* Cartes matrice */}
      <div className="space-y-4">
        {matricesInCategory.map((m) => {
          const items = (byMatrice[m.code] ?? []).slice().sort((a, b) => a.numOrdre - b.numOrdre);
          const total = items.length;
          const realisees = items.filter((i) => i.etat === 'realisee').length;
          const enCoursCount = items.filter((i) => i.etat === 'enCours').length;
          const attenteCount = items.filter((i) => i.etat === 'attente').length;
          const retards = items.filter((i) => i.etat === 'ineligible').length;
          const pct = total > 0 ? Math.round((realisees / total) * 100) : 0;

          return (
            <section
              key={m.code}
              className="bg-surface border border-border rounded-lg overflow-hidden"
            >
              <header className="bg-surface2 border-b border-border px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="w-9 h-9 rounded bg-primary text-white flex items-center justify-center font-mono font-semibold text-xs flex-shrink-0">
                  {m.code.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-fg">{m.label}</div>
                  <div className="text-xs text-fg-muted">
                    {total} recommandation{total > 1 ? 's' : ''} ·{' '}
                    <span className="text-success">{realisees} réalisée{realisees > 1 ? 's' : ''}</span> ·{' '}
                    <span className="text-warning">{enCoursCount} en cours</span> ·{' '}
                    <span className="text-primary">{attenteCount} en attente</span>
                    {retards > 0 && (
                      <>
                        {' '}·{' '}<span className="text-fg-muted">{retards} inéligible{retards > 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="w-36 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="font-mono font-semibold text-sm min-w-[40px] text-right">{pct}%</span>
                <Link
                  to="/bs/matrice"
                  className="text-xs text-primary hover:underline ml-2"
                  title="Éditer dans Saisie matrices"
                >
                  Éditer →
                </Link>
              </header>
              {total === 0 ? (
                <p className="text-sm text-fg-muted text-center py-6 italic">
                  Aucune recommandation rattachée à cette matrice.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {items.slice(0, 5).map((r) => (
                    <li
                      key={r.id}
                      className="px-4 py-3 grid grid-cols-[40px_1fr_120px] gap-3 items-start text-sm"
                    >
                      <span className="font-mono text-xs font-semibold text-fg-muted pt-0.5">
                        #{r.numOrdre}
                      </span>
                      <span className="text-fg-2 leading-snug">{r.texteRecommandation}</span>
                      <span className={cn(
                        'text-[11px] font-medium uppercase tracking-wider text-right',
                        r.etat === 'realisee' && 'text-success',
                        r.etat === 'enCours' && 'text-warning',
                        r.etat === 'attente' && 'text-primary',
                        r.etat === 'ineligible' && 'text-fg-muted',
                      )}>
                        {r.etat === 'realisee' && 'Réalisée'}
                        {r.etat === 'enCours' && 'En cours'}
                        {r.etat === 'attente' && 'En attente'}
                        {r.etat === 'ineligible' && 'Inéligible'}
                      </span>
                    </li>
                  ))}
                  {total > 5 && (
                    <li className="px-4 py-2 text-xs text-fg-muted italic">
                      +{total - 5} recommandation(s){' '}·{' '}
                      <Link to="/bs/matrice" className="text-primary hover:underline">
                        voir tout
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {kpis.total === 0 && (
        <div className="mt-5 bg-warning-bg border border-warning text-warning rounded-lg p-4 text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            Les matrices de cette catégorie ne contiennent aucune recommandation pour l&apos;instant.
            Va dans <Link to="/bs/matrice" className="underline">Saisie matrices</Link> pour en ajouter.
          </div>
        </div>
      )}
    </div>
  );
}
