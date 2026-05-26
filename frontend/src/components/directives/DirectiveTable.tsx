import { ChevronRight, Trash2 } from 'lucide-react';

import type { Directive } from '@mha-bs/shared';

import { cn } from '../../lib/cn.js';
import { daysBetween, formatShort, todayYmd } from '../../lib/formatDate.js';
import { Pagination } from '../ui/Pagination.js';
import { StateBadge } from '../ui/StateBadge.js';

interface Props {
  items: Directive[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onRowClick?: (directive: Directive) => void;
  // Admin-only : sélection + suppression
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onDeleteRow?: (id: string) => void;
}

export function DirectiveTable({
  items,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onRowClick,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  onDeleteRow,
}: Props) {
  const today = todayYmd();
  const selectedSet = new Set(selectedIds);
  const allOnPageIds = items.map((d) => d.id);
  const allSelectedOnPage =
    allOnPageIds.length > 0 && allOnPageIds.every((id) => selectedSet.has(id));
  const someSelectedOnPage = allOnPageIds.some((id) => selectedSet.has(id));

  const toggleAll = (): void => {
    if (!onSelectionChange) return;
    if (allSelectedOnPage) {
      // Désélectionne uniquement ceux de la page (préserve la sélection hors page)
      onSelectionChange(selectedIds.filter((id) => !allOnPageIds.includes(id)));
    } else {
      // Ajoute tous ceux de la page (sans doublonner)
      const merged = Array.from(new Set([...selectedIds, ...allOnPageIds]));
      onSelectionChange(merged);
    }
  };

  const toggleOne = (id: string): void => {
    if (!onSelectionChange) return;
    if (selectedSet.has(id)) {
      onSelectionChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="flex items-center px-4 py-3.5 gap-3 border-b border-border">
        <h2 className="text-md font-semibold">Liste des directives</h2>
        <span className="text-sm text-fg-muted">{totalCount} directives</span>
        {selectable && selectedIds.length > 0 && (
          <span className="text-sm text-primary font-medium font-mono">
            · {selectedIds.length} sélectionnée{selectedIds.length > 1 ? 's' : ''}
          </span>
        )}
        <div className="ml-auto text-sm text-fg-muted">
          Tri : <b className="text-fg">Date rencontre ↓</b>
        </div>
      </div>
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="bg-surface2 sticky top-0 z-10">
            <tr>
              {selectable && (
                <th className="px-3 py-2.5 border-b border-border w-10">
                  <input
                    type="checkbox"
                    aria-label="Tout sélectionner sur cette page"
                    checked={allSelectedOnPage}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelectedOnPage && !allSelectedOnPage;
                    }}
                    onChange={toggleAll}
                    className="accent-primary cursor-pointer"
                  />
                </th>
              )}
              <th className="text-left px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border w-24">
                Code
              </th>
              <th className="text-left px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border">
                Directive
              </th>
              <th className="text-left px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border w-28">
                Échéance
              </th>
              <th className="text-left px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border w-32">
                État
              </th>
              <th className="text-right px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border w-24">
                Retard
              </th>
              <th className={cn('border-b border-border', selectable ? 'w-16' : 'w-8')} />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={selectable ? 7 : 6} className="text-center text-fg-muted py-12 text-sm">
                  Aucune directive ne correspond aux critères.
                </td>
              </tr>
            ) : (
              items.map((d) => {
                const isLate =
                  (d.etat === 'enCours' || d.etat === 'attente') &&
                  d.echeance !== null &&
                  d.echeance < today;
                const daysLate = isLate && d.echeance ? daysBetween(d.echeance, today) : null;
                const isSelected = selectedSet.has(d.id);
                return (
                  <tr
                    key={d.id}
                    className={cn(
                      'border-b border-border last:border-0 hover:bg-muted',
                      isSelected && 'bg-primary-50',
                    )}
                  >
                    {selectable && (
                      <td className="px-3 py-3 align-top">
                        <input
                          type="checkbox"
                          aria-label={`Sélectionner ${d.codeDirective}`}
                          checked={isSelected}
                          onChange={() => toggleOne(d.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-primary cursor-pointer mt-1"
                        />
                      </td>
                    )}
                    <td
                      className="px-4 py-3 align-top cursor-pointer"
                      onClick={() => onRowClick?.(d)}
                    >
                      <span className="font-mono text-xs">{d.codeDirective}</span>
                    </td>
                    <td
                      className="px-4 py-3 max-w-[420px] cursor-pointer"
                      onClick={() => onRowClick?.(d)}
                    >
                      <div className="line-clamp-2 leading-snug text-fg">{d.texteDirective}</div>
                      {d.ministeresAssocies.length > 0 && (
                        <div className="text-[11.5px] text-fg-muted font-mono mt-1">
                          {d.ministeresAssocies.join(' · ')}
                        </div>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-xs cursor-pointer"
                      onClick={() => onRowClick?.(d)}
                    >
                      {formatShort(d.echeance)}
                    </td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => onRowClick?.(d)}>
                      <StateBadge etat={d.etat} />
                    </td>
                    <td
                      className="px-4 py-3 text-right cursor-pointer"
                      onClick={() => onRowClick?.(d)}
                    >
                      {daysLate !== null ? (
                        <span className="font-mono text-danger font-semibold">+{daysLate} j</span>
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      {onDeleteRow ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteRow(d.id);
                          }}
                          title="Supprimer cette directive"
                          className="text-fg-muted hover:text-danger p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span
                          className="text-fg-muted block cursor-pointer"
                          onClick={() => onRowClick?.(d)}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={onPageChange}
      />
    </div>
  );
}
