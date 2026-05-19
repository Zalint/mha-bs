import { Search } from 'lucide-react';

import { DIRECTIVE_ETATS, type DirectiveEtat } from '@mha-bs/shared';

import { cn } from '../../lib/cn.js';

export interface DirectiveFiltersValue {
  annee: string;
  etat: DirectiveEtat | '';
  search: string;
}

interface Props {
  value: DirectiveFiltersValue;
  onChange: (next: DirectiveFiltersValue) => void;
  availableYears: number[];
}

const ETAT_LABELS: Record<DirectiveEtat, string> = {
  attente: 'En attente',
  enCours: 'En cours',
  realisee: 'Réalisée',
  ineligible: 'Inéligible',
};

export function DirectiveFiltersBar({ value, onChange, availableYears }: Props) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 mb-4 flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="f-annee" className="field-label">
          Année
        </label>
        <select
          id="f-annee"
          className="select"
          value={value.annee}
          onChange={(e) => onChange({ ...value, annee: e.target.value })}
        >
          <option value="">Toutes</option>
          {availableYears.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-w-[240px]">
        <label htmlFor="f-search" className="field-label">
          Recherche directive
        </label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" />
          <input
            id="f-search"
            type="text"
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            placeholder="mot-clé dans le texte…"
            className="input pl-9"
          />
        </div>
      </div>
      <div className="flex gap-1.5 items-end">
        <FilterChip active={value.etat === ''} onClick={() => onChange({ ...value, etat: '' })}>
          Toutes
        </FilterChip>
        {DIRECTIVE_ETATS.map((e) => (
          <FilterChip
            key={e}
            active={value.etat === e}
            onClick={() => onChange({ ...value, etat: e })}
          >
            {ETAT_LABELS[e]}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterChip({ active, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors',
        active
          ? 'bg-primary-100 border-primary text-primary-700 font-medium'
          : 'bg-muted border-border text-fg-2 hover:bg-primary-50',
      )}
    >
      {children}
    </button>
  );
}
