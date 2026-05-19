import { ChevronRight } from 'lucide-react';

import type { Directive } from '@mha-bs/shared';

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
}

export function DirectiveTable({ items, totalCount, page, pageSize, onPageChange, onRowClick }: Props) {
  const today = todayYmd();
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="flex items-center px-4 py-3.5 gap-3 border-b border-border">
        <h2 className="text-md font-semibold">Liste des directives</h2>
        <span className="text-sm text-fg-muted">{totalCount} directives</span>
        <div className="ml-auto text-sm text-fg-muted">
          Tri : <b className="text-fg">Date rencontre ↓</b>
        </div>
      </div>
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="bg-surface2 sticky top-0 z-10">
            <tr>
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
              <th className="w-8 border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-fg-muted py-12 text-sm">
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
                return (
                  <tr
                    key={d.id}
                    onClick={() => onRowClick?.(d)}
                    className="border-b border-border last:border-0 hover:bg-muted cursor-pointer"
                  >
                    <td className="px-4 py-3 align-top">
                      <span className="font-mono text-xs">{d.codeDirective}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[420px]">
                      <div className="line-clamp-2 leading-snug text-fg">{d.texteDirective}</div>
                      {d.ministeresAssocies.length > 0 && (
                        <div className="text-[11.5px] text-fg-muted font-mono mt-1">
                          {d.ministeresAssocies.join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{formatShort(d.echeance)}</td>
                    <td className="px-4 py-3">
                      <StateBadge etat={d.etat} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {daysLate !== null ? (
                        <span className="font-mono text-danger font-semibold">+{daysLate} j</span>
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-fg-muted">
                      <ChevronRight className="w-4 h-4" />
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
