import { ChevronDown } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { cn } from '../../lib/cn.js';

interface ExpandableCardProps {
  title: string;
  subtitle?: string;
  /** Contenu affiché par défaut (KPIs simplifiés + mini histogramme). */
  children: ReactNode;
  /** Contenu révélé après click sur "Détail" (vue détaillée complète). */
  detail: ReactNode;
  /** Initialement déplié ? */
  defaultExpanded?: boolean;
  /** Si true, force l'expand (utile pour la génération PDF). */
  forceExpanded?: boolean;
}

/**
 * Carte avec mode compact par défaut et bouton "Détail ▾" qui déplie inline
 * la vue détaillée. Idéal pour les sections de dashboard à 2 niveaux de lecture.
 */
export function ExpandableCard({
  title,
  subtitle,
  children,
  detail,
  defaultExpanded = false,
  forceExpanded = false,
}: ExpandableCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isOpen = forceExpanded || expanded;

  return (
    <div className="bg-surface rounded-xl border-2 border-border hover:border-fg-muted transition-colors">
      <div className="flex items-start justify-between p-5 sm:p-6 pb-4">
        <div>
          <h3 className="font-semibold text-base text-fg">{title}</h3>
          {subtitle && <p className="text-xs text-fg-muted mt-0.5">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          aria-expanded={isOpen}
        >
          <span>Détail</span>
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 transition-transform',
              isOpen && 'rotate-180',
            )}
          />
        </button>
      </div>

      <div className="px-5 sm:px-6 pb-5 sm:pb-6">{children}</div>

      {isOpen && (
        <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-4 border-t border-border">
          <p className="text-xs text-fg-muted italic mb-3">↓ Vue détaillée</p>
          {detail}
        </div>
      )}
    </div>
  );
}
