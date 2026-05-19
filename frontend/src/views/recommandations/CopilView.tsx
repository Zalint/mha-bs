import { ArrowRight, ClipboardList, Download, Filter, FolderKanban, Landmark } from 'lucide-react';
import { useMemo } from 'react';

import type { RecommandationMatrice } from '@mha-bs/shared';

import { KpiCard } from '../../components/ui/KpiCard.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { useApi } from '../../hooks/useApi.js';
import { api } from '../../lib/apiClient.js';

interface CopilMeta {
  type: 'copilProgepIi' | 'copilPisea' | 'copilPaseaRd' | 'copilPdbh' | 'copilPromoren';
  name: string;
  short: string;
  sub: string;
  ptf: string;
}

const COPIL_LIST: CopilMeta[] = [
  {
    type: 'copilProgepIi',
    name: 'PROGEP II',
    short: 'PG2',
    sub: 'Projet de Gestion des Eaux Pluviales (Phase II)',
    ptf: 'Banque mondiale',
  },
  {
    type: 'copilPisea',
    name: 'PISEA',
    short: 'PSE',
    sub: "Programme d'Investissement Sectoriel Eau-Assainissement",
    ptf: 'Banque mondiale',
  },
  {
    type: 'copilPaseaRd',
    name: 'PASEA-RD',
    short: 'PRD',
    sub: "Programme d'Appui au Secteur Eau-Assainissement (Régions Diourbel)",
    ptf: 'BAD',
  },
  {
    type: 'copilPdbh',
    name: 'PDBH',
    short: 'PBH',
    sub: 'Programme Drainage Baie de Hann',
    ptf: 'Pays-Bas / INVEST INTL',
  },
  {
    type: 'copilPromoren',
    name: 'PROMOREN',
    short: 'PMR',
    sub: 'Projet de Mobilisation des Ressources en Eau',
    ptf: 'Fonds propres / OLAC',
  },
];

interface CopilCardData {
  meta: CopilMeta;
  items: RecommandationMatrice[];
  nbRealisees: number;
  nbEnCours: number;
  nbAttente: number;
  total: number;
  tauxExecution: number;
}

export function CopilView() {
  const matricesQuery = useApi(() => api.get<{ items: RecommandationMatrice[] }>('/matrices'), []);

  const cards = useMemo<CopilCardData[]>(() => {
    const all = matricesQuery.data?.items ?? [];
    return COPIL_LIST.map((meta) => {
      const items = all.filter((r) => r.typeMatrice === meta.type);
      const nbRealisees = items.filter((r) => r.etat === 'realisee').length;
      const nbEnCours = items.filter((r) => r.etat === 'enCours').length;
      const nbAttente = items.filter((r) => r.etat === 'attente').length;
      const total = items.length;
      return {
        meta,
        items,
        nbRealisees,
        nbEnCours,
        nbAttente,
        total,
        tauxExecution: total > 0 ? Math.round((nbRealisees / total) * 1000) / 10 : 0,
      };
    });
  }, [matricesQuery.data]);

  const totals = useMemo(() => {
    return cards.reduce(
      (acc, c) => ({
        total: acc.total + c.total,
        realisees: acc.realisees + c.nbRealisees,
        enCours: acc.enCours + c.nbEnCours,
        attente: acc.attente + c.nbAttente,
      }),
      { total: 0, realisees: 0, enCours: 0, attente: 0 },
    );
  }, [cards]);

  if (matricesQuery.isLoading) return <Spinner label="Chargement des COPIL…" />;
  if (matricesQuery.error) {
    return (
      <div className="bg-danger-bg border border-danger text-danger rounded-lg px-4 py-3 text-sm">
        Erreur de chargement des matrices.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-3">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-primary-100 text-primary-700 rounded text-[11.5px] font-semibold uppercase tracking-wider mb-2">
            <ClipboardList className="w-3.5 h-3.5" /> Recommandations MHA
          </div>
          <h1 className="text-2xl font-semibold text-fg leading-tight">COPIL</h1>
          <p className="text-sm text-fg-muted mt-1">
            Suivi des recommandations issues des 5 comités de pilotage du portefeuille MHA
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary">
            <Filter className="w-3.5 h-3.5" /> Filtres
          </button>
          <button type="button" className="btn btn-secondary">
            <Download className="w-3.5 h-3.5" /> Exporter
          </button>
        </div>
      </div>

      {/* KPIs globaux */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-5">
        <KpiCard label="COPIL suivis" value={cards.length} delta="Portefeuille MHA" icon={FolderKanban} />
        <KpiCard
          label="Recommandations"
          value={totals.total}
          delta="tous COPIL confondus"
          icon={ClipboardList}
        />
        <KpiCard
          label="Réalisées"
          value={totals.realisees}
          delta={`${totals.total > 0 ? Math.round((totals.realisees / totals.total) * 1000) / 10 : 0} %`}
          variant="success"
        />
        <KpiCard
          label="En cours / attente"
          value={totals.enCours + totals.attente}
          delta={`${totals.enCours} en cours · ${totals.attente} en attente`}
          variant="warning"
        />
      </div>

      {/* Comparatif d'avancement */}
      <div className="card mb-5">
        <div className="card-header">
          <h2 className="text-md font-semibold">Comparatif d'avancement par COPIL</h2>
          <div className="ml-auto flex gap-3 text-xs">
            <LegendItem color="#16A34A" label="Réalisé" />
            <LegendItem color="#D97706" label="En cours" />
            <LegendItem color="#0284C7" label="En attente" />
          </div>
        </div>
        <div className="card-body space-y-2.5">
          {cards.map((c) => {
            const tot = c.total || 1;
            return (
              <div key={c.meta.type} className="grid grid-cols-[130px_1fr_60px] gap-3 items-center">
                <div className="text-sm font-medium">{c.meta.name}</div>
                <div className="flex h-[22px] rounded overflow-hidden bg-muted">
                  {c.nbRealisees > 0 && (
                    <div
                      className="bg-success text-white text-[11px] font-mono font-semibold flex items-center justify-center"
                      style={{ width: `${(c.nbRealisees / tot) * 100}%` }}
                      title={`Réalisées : ${c.nbRealisees}`}
                    >
                      {c.nbRealisees}
                    </div>
                  )}
                  {c.nbEnCours > 0 && (
                    <div
                      className="bg-warning text-white text-[11px] font-mono font-semibold flex items-center justify-center"
                      style={{ width: `${(c.nbEnCours / tot) * 100}%` }}
                      title={`En cours : ${c.nbEnCours}`}
                    >
                      {c.nbEnCours}
                    </div>
                  )}
                  {c.nbAttente > 0 && (
                    <div
                      className="bg-primary text-white text-[11px] font-mono font-semibold flex items-center justify-center"
                      style={{ width: `${(c.nbAttente / tot) * 100}%` }}
                      title={`En attente : ${c.nbAttente}`}
                    >
                      {c.nbAttente}
                    </div>
                  )}
                </div>
                <div className="font-mono text-sm font-semibold text-right">{c.total}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cards detaillees */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <CopilCard key={c.meta.type} data={c} />
        ))}
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function CopilCard({ data }: { data: CopilCardData }) {
  const { meta, items, total, tauxExecution, nbRealisees, nbEnCours, nbAttente } = data;
  return (
    <div className="card overflow-hidden hover:border-primary hover:shadow-lg transition-all">
      <div className="card-header">
        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-primary to-secondary text-white font-bold font-mono flex items-center justify-center flex-shrink-0">
          {meta.short}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-md font-semibold text-fg">{meta.name}</h3>
          <p className="text-xs text-fg-muted mt-0.5 truncate">{meta.sub}</p>
        </div>
        <span className="badge bg-muted text-fg-2 whitespace-nowrap">
          <Landmark className="w-3 h-3" /> {meta.ptf}
        </span>
      </div>
      <div className="card-body">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-success rounded-full" style={{ width: `${tauxExecution}%` }} />
          </div>
          <span className="font-mono text-sm font-semibold">{tauxExecution} %</span>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-3">
          <Stat label="Réalisées" value={nbRealisees} className="text-success" />
          <Stat label="En cours" value={nbEnCours} className="text-warning" />
          <Stat label="Attente" value={nbAttente} className="text-primary" />
          <Stat label="Total" value={total} className="text-fg" />
        </div>

        <div className="space-y-1.5 text-xs">
          {items.slice(0, 3).map((r) => (
            <div key={r.id} className="flex gap-2 py-1.5 border-b border-border last:border-0">
              <span className="font-mono text-fg-muted">{r.numOrdre}</span>
              <span className="text-fg-2 line-clamp-1">{r.texteRecommandation.slice(0, 110)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="px-5 py-3 bg-surface2 border-t border-border flex justify-end">
        <a className="text-xs text-primary hover:underline inline-flex items-center gap-1">
          Détails <ArrowRight className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="bg-muted rounded p-2 text-center">
      <div className={`font-mono text-lg font-semibold ${className ?? ''}`}>{value}</div>
      <div className="text-[10.5px] text-fg-muted uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}
