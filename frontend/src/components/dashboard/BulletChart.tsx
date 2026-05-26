import { cn } from '../../lib/cn.js';

interface Props {
  /** Valeur courante en % (0-100) */
  value: number;
  /** Cible en % (0-100) */
  target: number;
  /** Ligne séparant zone "bad" et "ok" (0-100) */
  threshold1?: number;
  /** Ligne séparant zone "ok" et "good" (0-100) */
  threshold2?: number;
  /** Variante de couleur du remplissage */
  variant?: 'default' | 'success' | 'warning' | 'danger';
  /** Affiche les libellés 0% / cible / 100% sous la barre */
  showLabels?: boolean;
}

const FILL_STYLES = {
  default: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
} as const;

export function BulletChart({
  value,
  target,
  threshold1 = 50,
  threshold2 = 80,
  variant = 'default',
  showLabels = true,
}: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const targetClamped = Math.max(0, Math.min(100, target));
  return (
    <div>
      <div
        className="relative h-7 bg-muted rounded overflow-hidden"
        role="meter"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Avancement ${clamped} % · cible ${targetClamped} %`}
      >
        <div
          className="absolute inset-y-0 left-0 bg-danger-bg"
          style={{ width: `${threshold1}%` }}
        />
        <div
          className="absolute inset-y-0 bg-warning-bg"
          style={{ left: `${threshold1}%`, width: `${threshold2 - threshold1}%` }}
        />
        <div
          className="absolute inset-y-0 bg-success-bg"
          style={{ left: `${threshold2}%`, width: `${100 - threshold2}%` }}
        />
        <div
          className={cn('absolute inset-y-1 left-0 rounded-sm', FILL_STYLES[variant])}
          style={{ width: `${clamped}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-fg"
          style={{ left: `${targetClamped}%` }}
          aria-hidden
        />
      </div>
      {showLabels && (
        <div className="flex justify-between text-[10.5px] text-fg-muted mt-1 font-mono">
          <span>0%</span>
          <span>Cible {targetClamped}%</span>
          <span>100%</span>
        </div>
      )}
    </div>
  );
}
