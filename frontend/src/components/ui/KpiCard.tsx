import type { LucideIcon } from 'lucide-react';

import { cn } from '../../lib/cn.js';

interface Props {
  label: string;
  value: number | string;
  delta?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const ICON_STYLES: Record<NonNullable<Props['variant']>, string> = {
  default: 'bg-primary-100 text-primary',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
};

export function KpiCard({ label, value, delta, icon: Icon, variant = 'default' }: Props) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 relative animate-fade-up">
      <div className="text-xs text-fg-muted uppercase tracking-wider font-medium">{label}</div>
      <div className="font-mono text-3xl font-semibold text-fg mt-1.5 tabular-nums">{value}</div>
      {delta && <div className="text-xs text-fg-muted mt-1">{delta}</div>}
      {Icon && (
        <div
          className={cn(
            'absolute right-4 top-4 w-9 h-9 rounded-lg flex items-center justify-center',
            ICON_STYLES[variant],
          )}
        >
          <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
        </div>
      )}
    </div>
  );
}
