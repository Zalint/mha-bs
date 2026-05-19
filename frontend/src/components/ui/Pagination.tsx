import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '../../lib/cn.js';

interface Props {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, totalCount, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  const goTo = (p: number): void => {
    if (p < 1 || p > totalPages || p === page) return;
    onPageChange(p);
  };

  return (
    <div className="flex justify-between items-center px-4 py-3 border-t border-border text-sm text-fg-muted">
      <span>
        {start}-{end} sur <b className="text-fg">{totalCount}</b> directives
      </span>
      <div className="flex gap-1 items-center">
        <button
          type="button"
          aria-label="Page précédente"
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          className="w-8 h-8 border border-border rounded bg-surface flex items-center justify-center disabled:opacity-40 hover:bg-muted"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-mono text-xs px-2 min-w-[60px] text-center">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          aria-label="Page suivante"
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages}
          className={cn(
            'w-8 h-8 border border-border rounded bg-surface flex items-center justify-center',
            'disabled:opacity-40 hover:bg-muted',
          )}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
