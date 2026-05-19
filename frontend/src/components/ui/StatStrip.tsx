import { cn } from '../../lib/cn.js';

export interface StatCell {
  label: string;
  value: number | string;
  subtitle?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const VARIANT_STYLES = {
  default: 'text-fg',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-primary',
} as const;

interface Props {
  cells: StatCell[];
  className?: string;
}

export function StatStrip({ cells, className }: Props) {
  return (
    <div
      className={cn(
        'grid gap-px bg-border rounded-lg overflow-hidden',
        className ?? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
      )}
    >
      {cells.map((c, i) => (
        <div key={`${c.label}-${i}`} className="bg-surface px-4 py-3.5">
          <div className="text-[11px] uppercase tracking-wider text-fg-muted font-medium">{c.label}</div>
          <div
            className={cn(
              'font-mono text-xl font-semibold tabular-nums mt-0.5',
              VARIANT_STYLES[c.variant ?? 'default'],
            )}
          >
            {c.value}
          </div>
          {c.subtitle && <div className="text-[11.5px] text-fg-muted mt-0.5">{c.subtitle}</div>}
        </div>
      ))}
    </div>
  );
}
