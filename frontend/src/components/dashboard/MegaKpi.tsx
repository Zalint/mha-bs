import { cn } from '../../lib/cn.js';

interface Props {
  label: string;
  value: number | string;
  delta?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const VALUE_STYLES = {
  default: 'text-fg',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
} as const;

const DELTA_STYLES = {
  default: 'text-fg-muted',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
} as const;

export function MegaKpi({ label, value, delta, variant = 'default' }: Props) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="text-[10.5px] uppercase tracking-wider text-fg-muted font-medium">
        {label}
      </div>
      <div
        className={cn(
          'font-mono text-3xl font-bold mt-1 tabular-nums leading-none',
          VALUE_STYLES[variant],
        )}
      >
        {value}
      </div>
      {delta && (
        <div className={cn('text-[11.5px] mt-1.5 font-medium', DELTA_STYLES[variant])}>{delta}</div>
      )}
    </div>
  );
}
