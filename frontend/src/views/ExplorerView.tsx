/**
 * ExplorerView — "mode Power BI" : exploration ad-hoc des données.
 *
 * L'utilisateur choisit une source, glisse des dimensions/mesures, choisit un
 * type de graphe, applique des slicers (filtres), clique pour filtrer en
 * croisé, bascule en tableau croisé (pivot) et descend aux lignes brutes
 * (drill-down). Le tout via le moteur générique /api/visualisations/explorer/*.
 */

import {
  BarChart3,
  BarChartHorizontal,
  Download,
  Filter,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  RotateCcw,
  Table as TableIcon,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Spinner } from '../components/ui/Spinner.js';
import { api } from '../lib/apiClient.js';
import { cn } from '../lib/cn.js';

// ===== Types du schéma =====
interface FieldDef {
  key: string;
  label: string;
}
interface MeasureDef extends FieldDef {
  format: 'int' | 'decimal1' | 'percent';
}
interface FilterDef extends FieldDef {
  type: 'enum' | 'number' | 'text';
  values: { value: string; label: string }[] | null;
}
interface SourceSchema {
  key: string;
  label: string;
  dimensions: FieldDef[];
  measures: MeasureDef[];
  filters: FilterDef[];
}

interface QueryResult {
  rows: { dims: string[]; value: number }[];
  dimensionLabels: string[];
  measureLabel: string;
  measureFormat: string;
}

type ChartType = 'bar' | 'barStacked' | 'line' | 'donut' | 'pivot';

interface ActiveFilter {
  key: string;
  values: (string | number)[];
}

const PALETTE = [
  '#0284C7', '#F97316', '#A855F7', '#10B981', '#EC4899',
  '#F59E0B', '#06B6D4', '#8B5CF6', '#EF4444', '#84CC16',
];

const CHART_TYPES: { key: ChartType; label: string; icon: typeof BarChart3 }[] = [
  { key: 'bar', label: 'Barres', icon: BarChart3 },
  { key: 'barStacked', label: 'Barres empilées', icon: BarChartHorizontal },
  { key: 'line', label: 'Courbes', icon: LineChartIcon },
  { key: 'donut', label: 'Donut', icon: PieChartIcon },
  { key: 'pivot', label: 'Tableau croisé', icon: TableIcon },
];

function fmt(v: number, format: string): string {
  if (format === 'percent') return `${v.toFixed(1)} %`;
  if (format === 'decimal1') return v.toFixed(1);
  return String(v);
}

export function ExplorerView() {
  const [schema, setSchema] = useState<SourceSchema[] | null>(null);
  const [sourceKey, setSourceKey] = useState<string>('directives');

  const [dimX, setDimX] = useState<string>('');
  const [dimSeries, setDimSeries] = useState<string>('');
  const [measure, setMeasure] = useState<string>('count');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [filters, setFilters] = useState<ActiveFilter[]>([]);

  const [result, setResult] = useState<QueryResult | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drill-down
  const [rows, setRows] = useState<{ columns: string[]; rows: string[][] } | null>(null);
  const [showRows, setShowRows] = useState(false);

  const source = useMemo(
    () => schema?.find((s) => s.key === sourceKey) ?? null,
    [schema, sourceKey],
  );

  // Charge le schéma une fois
  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<{ sources: SourceSchema[] }>(
          '/visualisations/explorer/schema',
        );
        setSchema(res.sources);
      } catch {
        setError('Impossible de charger le schéma.');
      }
    })();
  }, []);

  // Quand on change de source : réinitialise les champs avec des défauts sensés
  useEffect(() => {
    if (!source) return;
    setDimX(source.dimensions[0]?.key ?? '');
    setDimSeries('');
    setMeasure(source.measures[0]?.key ?? 'count');
    setFilters([]);
    setRows(null);
    setShowRows(false);
  }, [source]);

  // Relance la requête à chaque changement de config
  useEffect(() => {
    if (!source || !dimX || !measure) return;
    setLoadingResult(true);
    setError(null);
    const dims = dimSeries && dimSeries !== dimX ? [dimX, dimSeries] : [dimX];
    void (async () => {
      try {
        const res = await api.post<QueryResult>('/visualisations/explorer/query', {
          source: sourceKey,
          dimensions: dims,
          measure,
          filters: filters.map((f) => ({ key: f.key, values: f.values })),
        });
        setResult(res);
      } catch {
        setError('Erreur lors de la requête.');
        setResult(null);
      } finally {
        setLoadingResult(false);
      }
    })();
  }, [source, sourceKey, dimX, dimSeries, measure, filters]);

  const loadRows = async (): Promise<void> => {
    setShowRows(true);
    try {
      const res = await api.post<{ columns: string[]; rows: string[][] }>(
        '/visualisations/explorer/rows',
        { source: sourceKey, filters: filters.map((f) => ({ key: f.key, values: f.values })) },
      );
      setRows(res);
    } catch {
      setRows({ columns: ['Erreur'], rows: [['Chargement impossible']] });
    }
  };

  // Cross-filter : clic sur un segment dont la dimension a un filtre équivalent
  const handleSegmentClick = (dimKey: string, value: string): void => {
    const filterDef = source?.filters.find((f) => f.key === dimKey);
    if (!filterDef) return; // pas de filtre correspondant pour cette dimension
    setFilters((prev) => {
      const existing = prev.find((f) => f.key === dimKey);
      if (existing) {
        // toggle la valeur
        const has = existing.values.map(String).includes(value);
        const nextValues = has
          ? existing.values.filter((v) => String(v) !== value)
          : [...existing.values, value];
        if (nextValues.length === 0) return prev.filter((f) => f.key !== dimKey);
        return prev.map((f) => (f.key === dimKey ? { ...f, values: nextValues } : f));
      }
      return [...prev, { key: dimKey, values: [value] }];
    });
  };

  const setFilterValues = (key: string, values: (string | number)[]): void => {
    setFilters((prev) => {
      const others = prev.filter((f) => f.key !== key);
      if (values.length === 0) return others;
      return [...others, { key, values }];
    });
  };

  if (!schema) return <Spinner label="Chargement de l'explorateur…" />;

  return (
    <div>
      {/* En-tête */}
      <div className="mb-4">
        <h2 className="text-md font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Explorateur (mode Power BI)
        </h2>
        <p className="text-xs text-fg-muted mt-0.5">
          Choisissez une source, des dimensions et une mesure. Cliquez sur le graphe
          pour filtrer en croisé.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* ===== Panneau de configuration ===== */}
        <div className="space-y-4">
          {/* Source */}
          <ConfigBlock title="Source de données">
            <select
              value={sourceKey}
              onChange={(e) => setSourceKey(e.target.value)}
              className="input input-sm text-xs w-full"
            >
              {schema.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </ConfigBlock>

          {/* Champs */}
          <ConfigBlock title="Axe X (dimension)">
            <select
              value={dimX}
              onChange={(e) => setDimX(e.target.value)}
              className="input input-sm text-xs w-full"
            >
              {source?.dimensions.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </ConfigBlock>

          <ConfigBlock title="Découpage / série (optionnel)">
            <select
              value={dimSeries}
              onChange={(e) => setDimSeries(e.target.value)}
              className="input input-sm text-xs w-full"
              disabled={chartType === 'donut'}
            >
              <option value="">— Aucun —</option>
              {source?.dimensions
                .filter((d) => d.key !== dimX)
                .map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
            </select>
          </ConfigBlock>

          <ConfigBlock title="Mesure">
            <select
              value={measure}
              onChange={(e) => setMeasure(e.target.value)}
              className="input input-sm text-xs w-full"
            >
              {source?.measures.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </ConfigBlock>

          {/* Type de graphe */}
          <ConfigBlock title="Type de visualisation">
            <div className="grid grid-cols-2 gap-1.5">
              {CHART_TYPES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setChartType(c.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1.5 rounded border text-[11px] transition-colors',
                    chartType === c.key
                      ? 'border-primary bg-primary-100 text-primary-700 font-semibold'
                      : 'border-border bg-surface text-fg-muted hover:bg-muted',
                  )}
                >
                  <c.icon className="w-3 h-3" />
                  {c.label}
                </button>
              ))}
            </div>
          </ConfigBlock>

          {/* Slicers */}
          <ConfigBlock
            title={
              <span className="flex items-center gap-1.5">
                <Filter className="w-3 h-3" /> Filtres (slicers)
              </span>
            }
          >
            <div className="space-y-2.5">
              {source?.filters.map((f) => (
                <SlicerControl
                  key={f.key}
                  filter={f}
                  selected={filters.find((af) => af.key === f.key)?.values ?? []}
                  onChange={(vals) => setFilterValues(f.key, vals)}
                />
              ))}
              {source && source.filters.length === 0 && (
                <p className="text-[11px] text-fg-muted italic">
                  Aucun filtre pour cette source.
                </p>
              )}
            </div>
          </ConfigBlock>

          {filters.length > 0 && (
            <button
              type="button"
              onClick={() => setFilters([])}
              className="w-full btn btn-ghost btn-sm text-xs"
            >
              <RotateCcw className="w-3 h-3" /> Réinitialiser les filtres
            </button>
          )}
        </div>

        {/* ===== Zone de visualisation ===== */}
        <div className="space-y-4">
          {/* Chips des filtres actifs */}
          {filters.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {filters.map((f) => {
                const def = source?.filters.find((x) => x.key === f.key);
                return (
                  <span
                    key={f.key}
                    className="inline-flex items-center gap-1 bg-primary-100 text-primary-700 rounded-full px-2.5 py-1 text-[11px] font-medium"
                  >
                    {def?.label ?? f.key}: {f.values.map((v) => labelFor(def, v)).join(', ')}
                    <button
                      type="button"
                      onClick={() => setFilterValues(f.key, [])}
                      className="hover:text-primary"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Graphe */}
          <div className="bg-surface border border-border rounded-xl p-4 min-h-[360px]">
            {error ? (
              <div className="text-danger text-sm py-12 text-center">{error}</div>
            ) : loadingResult && !result ? (
              <Spinner label="Calcul…" />
            ) : !result || result.rows.length === 0 ? (
              <div className="text-fg-muted text-sm py-12 text-center italic">
                Aucune donnée pour cette combinaison.
              </div>
            ) : (
              <ChartRenderer
                chartType={chartType}
                result={result}
                dimX={source?.dimensions.find((d) => d.key === dimX)?.label ?? dimX}
                hasSeries={Boolean(dimSeries && dimSeries !== dimX)}
                onSegmentClick={(value) => handleSegmentClick(dimX, value)}
              />
            )}
          </div>

          {/* Drill-down */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-surface2 flex items-center justify-between">
              <span className="text-sm font-semibold">Données détaillées</span>
              <div className="flex gap-2">
                {rows && (
                  <button
                    type="button"
                    onClick={() => exportCsv(rows)}
                    className="btn btn-ghost btn-sm text-xs"
                  >
                    <Download className="w-3 h-3" /> CSV
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (showRows ? setShowRows(false) : void loadRows())}
                  className="btn btn-secondary btn-sm text-xs"
                >
                  {showRows ? 'Masquer' : 'Voir les lignes'}
                </button>
              </div>
            </div>
            {showRows && (
              <div className="overflow-auto max-h-80">
                {!rows ? (
                  <Spinner label="Chargement…" />
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-surface2 sticky top-0">
                      <tr>
                        {rows.columns.map((c) => (
                          <th
                            key={c}
                            className="text-left px-3 py-2 font-semibold text-fg-muted border-b border-border whitespace-nowrap"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.rows.map((r, i) => (
                        <tr key={i} className="border-b border-border last:border-0 hover:bg-muted">
                          {r.map((cell, j) => (
                            <td key={j} className="px-3 py-1.5 align-top">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Rendu du graphe selon le type
// ===========================================================================

function ChartRenderer({
  chartType,
  result,
  dimX,
  hasSeries,
  onSegmentClick,
}: {
  chartType: ChartType;
  result: QueryResult;
  dimX: string;
  hasSeries: boolean;
  onSegmentClick: (value: string) => void;
}) {
  // Pivot des rows en données Recharts
  const { data, seriesKeys } = useMemo(() => {
    if (hasSeries) {
      // [{dims:[x, series], value}] → [{x, series1: v, series2: v}]
      const map = new Map<string, Record<string, string | number>>();
      const keys = new Set<string>();
      for (const r of result.rows) {
        const x = r.dims[0] ?? '(vide)';
        const s = r.dims[1] ?? '(vide)';
        keys.add(s);
        if (!map.has(x)) map.set(x, { __x: x });
        map.get(x)![s] = r.value;
      }
      return { data: Array.from(map.values()), seriesKeys: Array.from(keys) };
    }
    return {
      data: result.rows.map((r) => ({ __x: r.dims[0] ?? '(vide)', value: r.value })),
      seriesKeys: ['value'],
    };
  }, [result, hasSeries]);

  // ----- Tableau croisé (pivot) -----
  if (chartType === 'pivot') {
    return <PivotTable result={result} hasSeries={hasSeries} dimX={dimX} />;
  }

  // ----- Donut (1 dimension) -----
  if (chartType === 'donut') {
    const pieData = result.rows.map((r) => ({ name: r.dims[0] ?? '(vide)', value: r.value }));
    return (
      <ResponsiveContainer width="100%" height={340}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={120}
            label={(p: { name?: string; value?: number }) => `${p.name}: ${p.value}`}
            onClick={(d: { name?: string }) => d.name && onSegmentClick(String(d.name))}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} cursor="pointer" />
            ))}
          </Pie>
          <Tooltip formatter={(v) => fmt(Number(v), result.measureFormat)} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // ----- Courbes -----
  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="__x" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => fmt(Number(v), result.measureFormat)} />
          {hasSeries && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {seriesKeys.map((k, i) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              name={k === 'value' ? result.measureLabel : k}
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={2}
              dot={{ r: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // ----- Barres (simples ou empilées) -----
  const stacked = chartType === 'barStacked';
  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="__x" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => fmt(Number(v), result.measureFormat)} />
        {hasSeries && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {seriesKeys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            name={k === 'value' ? result.measureLabel : k}
            stackId={stacked ? 'a' : undefined}
            fill={PALETTE[i % PALETTE.length]}
            cursor="pointer"
            onClick={(barData) => {
              const x = (barData as unknown as { payload?: { __x?: string } }).payload?.__x;
              if (x) onSegmentClick(String(x));
            }}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ===========================================================================
// Tableau croisé (pivot)
// ===========================================================================

function PivotTable({
  result,
  hasSeries,
  dimX,
}: {
  result: QueryResult;
  hasSeries: boolean;
  dimX: string;
}) {
  if (!hasSeries) {
    // Simple : 1 colonne dim + 1 colonne mesure
    return (
      <div className="overflow-auto max-h-[340px]">
        <table className="w-full text-sm">
          <thead className="bg-surface2 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-semibold border-b border-border">{dimX}</th>
              <th className="text-right px-3 py-2 font-semibold border-b border-border">
                {result.measureLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-muted">
                <td className="px-3 py-1.5">{r.dims[0]}</td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                  {fmt(r.value, result.measureFormat)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 2 dims : pivot dim0 (lignes) × dim1 (colonnes)
  const rowKeys: string[] = [];
  const colKeys: string[] = [];
  const cell = new Map<string, number>();
  for (const r of result.rows) {
    const x = r.dims[0] ?? '(vide)';
    const c = r.dims[1] ?? '(vide)';
    if (!rowKeys.includes(x)) rowKeys.push(x);
    if (!colKeys.includes(c)) colKeys.push(c);
    cell.set(`${x}|${c}`, r.value);
  }

  return (
    <div className="overflow-auto max-h-[340px]">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-surface2 sticky top-0">
          <tr>
            <th className="text-left px-3 py-2 font-semibold border-b border-r border-border">
              {dimX}
            </th>
            {colKeys.map((c) => (
              <th key={c} className="text-right px-3 py-2 font-semibold border-b border-border whitespace-nowrap">
                {c}
              </th>
            ))}
            <th className="text-right px-3 py-2 font-semibold border-b border-l border-border bg-surface2">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((x) => {
            const rowTotal = colKeys.reduce((s, c) => s + (cell.get(`${x}|${c}`) ?? 0), 0);
            return (
              <tr key={x} className="border-b border-border last:border-0 hover:bg-muted">
                <td className="px-3 py-1.5 border-r border-border font-medium">{x}</td>
                {colKeys.map((c) => (
                  <td key={c} className="px-3 py-1.5 text-right font-mono tabular-nums">
                    {cell.has(`${x}|${c}`) ? fmt(cell.get(`${x}|${c}`)!, result.measureFormat) : '—'}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right font-mono tabular-nums font-bold border-l border-border">
                  {fmt(rowTotal, result.measureFormat)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ===========================================================================
// Petits composants
// ===========================================================================

function ConfigBlock({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-3">
      <div className="text-[10.5px] uppercase tracking-wider text-fg-muted font-semibold mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

function SlicerControl({
  filter,
  selected,
  onChange,
}: {
  filter: FilterDef;
  selected: (string | number)[];
  onChange: (values: (string | number)[]) => void;
}) {
  if (filter.type === 'enum' && filter.values) {
    return (
      <div>
        <div className="text-[11px] font-medium text-fg-2 mb-1">{filter.label}</div>
        <div className="flex flex-wrap gap-1">
          {filter.values.map((v) => {
            const active = selected.map(String).includes(v.value);
            return (
              <button
                key={v.value}
                type="button"
                onClick={() =>
                  onChange(
                    active
                      ? selected.filter((s) => String(s) !== v.value)
                      : [...selected, v.value],
                  )
                }
                className={cn(
                  'px-2 py-0.5 rounded text-[10.5px] border transition-colors',
                  active
                    ? 'border-primary bg-primary-100 text-primary-700 font-semibold'
                    : 'border-border bg-surface text-fg-muted hover:bg-muted',
                )}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  // number / text : input simple (valeur unique)
  return (
    <div>
      <div className="text-[11px] font-medium text-fg-2 mb-1">{filter.label}</div>
      <input
        type={filter.type === 'number' ? 'number' : 'text'}
        value={selected[0] ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? [] : [e.target.value])}
        placeholder="(tous)"
        className="input input-sm text-xs w-full"
      />
    </div>
  );
}

function labelFor(def: FilterDef | undefined, value: string | number): string {
  if (def?.values) {
    return def.values.find((v) => v.value === String(value))?.label ?? String(value);
  }
  return String(value);
}

function exportCsv(data: { columns: string[]; rows: string[][] }): void {
  const escape = (s: string): string =>
    /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const lines = [
    data.columns.map(escape).join(';'),
    ...data.rows.map((r) => r.map(escape).join(';')),
  ];
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'explorer-export.csv';
  a.click();
  URL.revokeObjectURL(url);
}
