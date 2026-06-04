/**
 * Popover d'aide pour le filtre "Année" — affiche un tableau comparatif
 * montrant comment chaque mode (active / création / échéance) inclut ou
 * exclut quelques directives types selon l'année sélectionnée.
 *
 * Déclenché par un bouton (i) à côté du label "Année active".
 */

import * as Dialog from '@radix-ui/react-dialog';
import { Info, X } from 'lucide-react';

import { cn } from '../../lib/cn.js';

interface Props {
  /** Mode actuellement sélectionné — surligné dans le tableau. */
  currentMode?: 'active' | 'creation' | 'echeance';
}

interface Row {
  label: string;
  /** Liste des années où la directive apparaît, par mode. */
  active: number[];
  creation: number[];
  echeance: number[];
}

const ROWS: Row[] = [
  // Émise N + réalisée : visible uniquement pour N (année cible : on montre tout)
  {
    label: 'Émise 2024, déjà réalisée (echéance 2024)',
    active: [2024], // visible uniquement pour son année d'émission
    creation: [2024],
    echeance: [2024],
  },
  // Émise + encore en cours : reste visible pour son année + toutes les suivantes
  {
    label: 'Émise 2024, encore en cours (sans échéance)',
    active: [2024, 2025, 2026, 2027],
    creation: [2024],
    echeance: [], // pas d'échéance
  },
  // Émise + en cours avec échéance future : pareil — c'est l'état qui compte
  {
    label: 'Émise 2024, en cours, échéance 2026',
    active: [2024, 2025, 2026, 2027], // visible tant que l'état reste en cours
    creation: [2024],
    echeance: [2026],
  },
  // Émise N et encore en attente : reste visible tant que ouverte
  {
    label: 'Émise 2025, encore en attente',
    active: [2025, 2026, 2027],
    creation: [2025],
    echeance: [],
  },
  // Émise N, réalisée plus tard : visible uniquement pour N (pas après car close)
  {
    label: 'Émise 2024, réalisée plus tard (échéance 2026)',
    active: [2024], // visible pour son année d'émission seulement
    creation: [2024],
    echeance: [2026],
  },
  // Émise N année cible : visible quel que soit l'état (tout pour l'année cible)
  {
    label: 'Émise 2026, déjà réalisée ou inéligible',
    active: [2026],
    creation: [2026],
    echeance: [], // dépend du cas, omis ici
  },
];

const YEARS = [2024, 2025, 2026, 2027] as const;

export function AnneeFilterHelp({ currentMode = 'active' }: Props) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="text-fg-muted hover:text-primary p-0.5 rounded"
          title="Aide sur le filtre Année"
          aria-label="Aide sur le filtre Année"
        >
          <Info className="w-3 h-3" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1200] bg-black/40" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1200]',
            'w-[min(95vw,820px)] max-h-[92vh] overflow-auto',
            'bg-surface rounded-xl shadow-2xl border border-border',
          )}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface2">
            <Dialog.Title className="text-base font-semibold flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              Filtre « Année » — sémantique paramétrable
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="text-fg-muted hover:text-fg p-1 rounded"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="px-5 py-4 space-y-4 text-sm">
            <p className="text-fg-2">
              Trois manières d'interpréter « directives de l'année N » selon le mode choisi.
              Le tableau montre dans quelles années chaque directive type apparaît :
            </p>

            {/* Tableau comparatif */}
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-surface2">
                    <th className="text-left px-3 py-2 border-b-2 border-border text-fg font-semibold">
                      Directive
                    </th>
                    <th
                      colSpan={4}
                      className={cn(
                        'text-center px-2 py-1.5 border-b border-border text-[11px] uppercase tracking-wider font-semibold',
                        currentMode === 'active' ? 'bg-primary-100 text-primary-700' : 'text-fg-muted',
                      )}
                    >
                      Mode Active pendant
                    </th>
                    <th
                      colSpan={4}
                      className={cn(
                        'text-center px-2 py-1.5 border-b border-border text-[11px] uppercase tracking-wider font-semibold border-l border-border',
                        currentMode === 'creation' ? 'bg-primary-100 text-primary-700' : 'text-fg-muted',
                      )}
                    >
                      Mode Création
                    </th>
                    <th
                      colSpan={4}
                      className={cn(
                        'text-center px-2 py-1.5 border-b border-border text-[11px] uppercase tracking-wider font-semibold border-l border-border',
                        currentMode === 'echeance' ? 'bg-primary-100 text-primary-700' : 'text-fg-muted',
                      )}
                    >
                      Mode Échéance
                    </th>
                  </tr>
                  <tr className="bg-surface2">
                    <th className="text-left px-3 py-2 border-b-2 border-border" />
                    {[...YEARS, ...YEARS, ...YEARS].map((y, i) => (
                      <th
                        key={i}
                        className={cn(
                          'text-center px-2 py-2 border-b-2 border-border font-mono text-xs text-fg-muted',
                          i === 4 || i === 8 ? 'border-l border-border' : '',
                        )}
                      >
                        {y}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row, idx) => (
                    <tr
                      key={idx}
                      className={cn(
                        idx % 2 === 0 ? 'bg-surface' : 'bg-surface2/50',
                        'border-b border-border',
                      )}
                    >
                      <td className="px-3 py-2 text-fg text-[13px]">{row.label}</td>
                      {YEARS.map((y, i) => (
                        <td
                          key={`a-${i}`}
                          className={cn(
                            'text-center px-2 py-2',
                            currentMode === 'active'
                              ? row.active.includes(y)
                                ? 'bg-primary-100/40 text-primary-700 font-semibold'
                                : 'text-fg-muted'
                              : row.active.includes(y)
                                ? 'text-success'
                                : 'text-fg-muted',
                          )}
                        >
                          {row.active.includes(y) ? '✓' : '—'}
                        </td>
                      ))}
                      {YEARS.map((y, i) => (
                        <td
                          key={`c-${i}`}
                          className={cn(
                            'text-center px-2 py-2',
                            i === 0 ? 'border-l border-border' : '',
                            currentMode === 'creation'
                              ? row.creation.includes(y)
                                ? 'bg-primary-100/40 text-primary-700 font-semibold'
                                : 'text-fg-muted'
                              : row.creation.includes(y)
                                ? 'text-success'
                                : 'text-fg-muted',
                          )}
                        >
                          {row.creation.includes(y) ? '✓' : '—'}
                        </td>
                      ))}
                      {YEARS.map((y, i) => (
                        <td
                          key={`e-${i}`}
                          className={cn(
                            'text-center px-2 py-2',
                            i === 0 ? 'border-l border-border' : '',
                            currentMode === 'echeance'
                              ? row.echeance.includes(y)
                                ? 'bg-primary-100/40 text-primary-700 font-semibold'
                                : 'text-fg-muted'
                              : row.echeance.includes(y)
                                ? 'text-success'
                                : 'text-fg-muted',
                          )}
                        >
                          {row.echeance.includes(y) ? '✓' : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartes explicatives par mode */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              <ModeCard
                title="Active pendant"
                active={currentMode === 'active'}
                description="Pour l'année cible N : on montre TOUTES les directives émises en N (peu importe l'état). Pour les années antérieures (r.annee < N) : uniquement celles encore ouvertes (état attente ou enCours). L'échéance n'intervient PAS."
                bestFor="Vue SG : « nouveautés de l'année + backlog qui traîne »."
              />
              <ModeCard
                title="Création"
                active={currentMode === 'creation'}
                description="La directive a été émise en N — date de la rencontre = N. Strict. Une directive émise en 2025 mais à échéance 2026 n'apparaît que pour 2025."
                bestFor="Reporting des nouveautés de l'année."
              />
              <ModeCard
                title="Échéance"
                active={currentMode === 'echeance'}
                description="L'échéance tombe en N (année calendaire). Exclut les directives sans échéance."
                bestFor="Suivi des deadlines : « ce qui doit être bouclé en N »."
              />
            </div>
          </div>

          <div className="px-5 py-3 border-t border-border bg-surface2 flex justify-end">
            <Dialog.Close asChild>
              <button type="button" className="btn btn-primary btn-sm">
                Fermer
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface ModeCardProps {
  title: string;
  active: boolean;
  description: string;
  bestFor: string;
}

function ModeCard({ title, active, description, bestFor }: ModeCardProps) {
  return (
    <div
      className={cn(
        'border rounded-lg p-3',
        active ? 'border-primary bg-primary-100/20' : 'border-border bg-surface',
      )}
    >
      <div
        className={cn(
          'text-xs font-bold uppercase tracking-wider mb-1.5',
          active ? 'text-primary-700' : 'text-fg-muted',
        )}
      >
        {title} {active && <span className="text-[10px] normal-case">· actuel</span>}
      </div>
      <p className="text-xs text-fg-2 mb-2 leading-relaxed">{description}</p>
      <p className="text-[10.5px] text-fg-muted italic">{bestFor}</p>
    </div>
  );
}
