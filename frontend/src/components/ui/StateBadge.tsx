import type { DirectiveEtat } from '@mha-bs/shared';

import { cn } from '../../lib/cn.js';

const LABELS: Record<DirectiveEtat, string> = {
  attente: 'En attente',
  enCours: 'En cours',
  realisee: 'Réalisée',
  ineligible: 'Inéligible',
};

const STYLES: Record<DirectiveEtat, string> = {
  attente: 'bg-info-bg text-info',
  enCours: 'bg-warning-bg text-warning',
  realisee: 'bg-success-bg text-success',
  ineligible: 'bg-neutral-bg text-neutral',
};

interface Props {
  etat: DirectiveEtat;
  className?: string;
}

export function StateBadge({ etat, className }: Props) {
  return (
    <span className={cn('badge', STYLES[etat], className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {LABELS[etat]}
    </span>
  );
}
