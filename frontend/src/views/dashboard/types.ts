import type { MissionTerrain } from '@mha-bs/shared';

export interface GlobalKpis {
  totalDirectives: number;
  nbRealisees: number;
  nbEnCours: number;
  nbAttente: number;
  nbIneligibles: number;
  nbRetards: number;
  tauxExecution: number;
}

export interface SgSummaryResponse {
  annee: number | null;
  availableYears: number[];
  directives: {
    conseilMinistres: GlobalKpis;
    conseilInterMinisteriel: GlobalKpis;
    coordinationSggSg: GlobalKpis;
  };
  copil: {
    copilSuivis: number;
    recommandations: number;
    nbRealisees: number;
    nbEnCours: number;
    nbAttente: number;
  };
  recommandationsParCategorie: {
    code: string;
    label: string;
    nbMatrices: number;
    recommandations: number;
    nbRealisees: number;
    nbEnCours: number;
    nbAttente: number;
  }[];
  reunionsTechniques: {
    reunionsTenues: number;
    parMois: { yearMonth: string; count: number }[];
    parSousSecteur: { key: string; label: string; count: number }[];
    parCopil: { copil: string; count: number }[];
  };
  missionsTerrain: {
    missionsEffectuees: number;
    regionsCouvertes: number;
    totalRegions: number;
    prochaineDate: string | null;
    prochaineLocalite: string | null;
  };
}

export interface DashboardViewProps {
  data: SgSummaryResponse;
  missions: MissionTerrain[];
  annee: number | null;       // null = toutes les années
  anneeLabel: string;         // affichage : "année 2026" ou "toutes années"
}

export function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * Calcule les KPIs globaux (total des 3 types de directives).
 */
export function computeAggregate(d: SgSummaryResponse['directives']): GlobalKpis {
  const all = [d.conseilMinistres, d.conseilInterMinisteriel, d.coordinationSggSg];
  const sum = (k: keyof GlobalKpis) => all.reduce((acc, x) => acc + x[k], 0);
  const total = sum('totalDirectives');
  const real = sum('nbRealisees');
  return {
    totalDirectives: total,
    nbRealisees: real,
    nbEnCours: sum('nbEnCours'),
    nbAttente: sum('nbAttente'),
    nbIneligibles: sum('nbIneligibles'),
    nbRetards: sum('nbRetards'),
    tauxExecution: total > 0 ? Math.round((real / total) * 1000) / 10 : 0,
  };
}

export interface RecommandationsAggregate {
  total: number;
  nbRealisees: number;
  nbEnCours: number;
  nbAttente: number;
  tauxExecution: number;
}

/**
 * Agrège toutes les catégories de recommandations en un total global.
 */
export function computeRecommandationsAggregate(
  categories: SgSummaryResponse['recommandationsParCategorie'],
): RecommandationsAggregate {
  const total = categories.reduce((acc, c) => acc + c.recommandations, 0);
  const real = categories.reduce((acc, c) => acc + c.nbRealisees, 0);
  return {
    total,
    nbRealisees: real,
    nbEnCours: categories.reduce((acc, c) => acc + c.nbEnCours, 0),
    nbAttente: categories.reduce((acc, c) => acc + c.nbAttente, 0),
    tauxExecution: total > 0 ? Math.round((real / total) * 1000) / 10 : 0,
  };
}

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const monthIdx = Number(month) - 1;
  return `${MONTH_LABELS[monthIdx] ?? month} ${year?.slice(2) ?? ''}`;
}
