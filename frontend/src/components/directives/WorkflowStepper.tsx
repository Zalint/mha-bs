import { Check } from 'lucide-react';

import type { StatutValidation } from '@mha-bs/shared';

import { cn } from '../../lib/cn.js';
import { formatShort } from '../../lib/formatDate.js';

interface Props {
  statut: StatutValidation;
  createdAt?: string | null;
  validatedAt?: string | null;
  createdByName?: string | null;
  validatedByName?: string | null;
}

interface Step {
  label: string;
  meta: string;
  status: 'done' | 'current' | 'pending';
}

export function WorkflowStepper({ statut, createdAt, validatedAt, createdByName, validatedByName }: Props) {
  const steps: Step[] = [
    {
      label: 'Création BS',
      meta: createdAt ? `${formatShort(createdAt.slice(0, 10))} · ${createdByName ?? 'Inconnu'}` : '—',
      status: 'done',
    },
    {
      label: statut === 'brouillon' ? 'Saisie en cours' : 'Saisie',
      meta: statut === 'brouillon' ? 'En cours' : 'Soumise',
      status: statut === 'brouillon' ? 'current' : 'done',
    },
    {
      label: 'Validation',
      meta:
        statut === 'valide'
          ? `${validatedAt ? formatShort(validatedAt.slice(0, 10)) : '—'} · ${validatedByName ?? 'Inconnu'}`
          : statut === 'soumis'
            ? 'En attente'
            : '—',
      status: statut === 'valide' ? 'done' : statut === 'soumis' ? 'current' : 'pending',
    },
    {
      label: 'Clôture',
      meta: statut === 'valide' ? 'Clôturée' : '—',
      status: statut === 'valide' ? 'done' : 'pending',
    },
  ];

  return (
    <div className="space-y-2.5">
      {steps.map((step, i) => (
        <div
          key={step.label}
          className={cn(
            'flex gap-3 p-3 border rounded items-start transition-colors',
            step.status === 'current' && 'border-primary bg-primary-50',
            step.status === 'pending' && 'border-border',
            step.status === 'done' && 'border-border',
          )}
        >
          <div
            className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-semibold flex-shrink-0',
              step.status === 'done' && 'bg-success text-white',
              step.status === 'current' && 'bg-primary text-white',
              step.status === 'pending' && 'bg-muted text-fg-muted',
            )}
          >
            {step.status === 'done' ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-fg">{step.label}</div>
            <div className="text-[11.5px] text-fg-muted font-mono mt-0.5 truncate">{step.meta}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
