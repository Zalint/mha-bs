import { type LucideIcon } from 'lucide-react';

import { cn } from '../../lib/cn.js';

export interface RadioCardOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'neutral';
}

interface Props<T extends string> {
  name: string;
  value: T;
  onChange: (next: T) => void;
  options: RadioCardOption<T>[];
}

const VARIANT_STYLES: Record<NonNullable<RadioCardOption<string>['variant']>, string> = {
  default: 'bg-primary-100 border-primary text-primary-700',
  success: 'bg-success-bg border-success text-success',
  warning: 'bg-warning-bg border-warning text-warning',
  danger: 'bg-danger-bg border-danger text-danger',
  neutral: 'bg-neutral-bg border-neutral text-neutral',
};

export function RadioCards<T extends string>({ name, value, onChange, options }: Props<T>) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const checked = opt.value === value;
        const Icon = opt.icon;
        return (
          <label key={opt.value} className="relative cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onChange(opt.value)}
              className="absolute opacity-0 pointer-events-none"
            />
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-2 border rounded text-sm transition-colors',
                'bg-surface border-border text-fg-2 hover:bg-muted',
                checked && (VARIANT_STYLES[opt.variant ?? 'default'] + ' font-medium'),
              )}
            >
              {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />}
              {opt.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}
