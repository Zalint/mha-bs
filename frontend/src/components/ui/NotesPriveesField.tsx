/**
 * NotesPriveesField — gros textarea avec :
 *   - Resize vertical natif (handle navigateur en bas droit)
 *   - Bouton "Plein écran" qui ouvre une modale couvrant la fenêtre entière
 *     (Echap pour sortir, sauvegarde du contenu vers le parent à la fermeture)
 *   - Auto-save vers localStorage toutes les N minutes (intervalle configurable
 *     1/5/10/15/30 min ou désactivé). Default 10 min.
 *   - Indicateur "Sauvegardé il y a X" qui se rafraîchit chaque minute
 *
 * Le composant est CONTRÔLÉ par le parent (value + onChange) — il pousse aussi
 * vers localStorage en background pour permettre la restauration en cas de
 * crash/fermeture accidentelle. Le parent peut récupérer le brouillon via la
 * fonction utilitaire `readNotesDraft(storageKey)`.
 *
 * Quand le parent soumet le formulaire avec succès, il doit appeler
 * `clearNotesDraft(storageKey)` pour nettoyer.
 *
 * NB : visible uniquement par le créateur de la réunion — la garde est dans le
 * parent (rendu conditionnel) ET côté backend (notesPrivees = null pour les
 * autres).
 */

import { Maximize2, Minimize2, NotebookPen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '../../lib/cn.js';

const AUTOSAVE_INTERVALS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: '1 min' },
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 0, label: 'Désactivé' },
];

const INTERVAL_PREF_LS_KEY = 'bs-notes-autosave-min';

/** Lit la valeur d'un brouillon localStorage (utile au montage du parent). */
export function readNotesDraft(storageKey: string): { content: string; ts: number } | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { content: string; ts: number };
    if (typeof parsed.content !== 'string' || typeof parsed.ts !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Supprime le brouillon localStorage (à appeler après un submit réussi). */
export function clearNotesDraft(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
}

interface NotesPriveesFieldProps {
  value: string;
  onChange: (next: string) => void;
  /** Clé localStorage pour l'auto-save. Unique par contexte (ex. user-new-reunion). */
  storageKey: string;
  /** Nombre de lignes par défaut dans le textarea (avant resize manuel). */
  rows?: number;
  /** Placeholder du textarea. */
  placeholder?: string;
}

export function NotesPriveesField({
  value,
  onChange,
  storageKey,
  rows = 10,
  placeholder = 'Prise de notes libre — uniquement visible par vous. Auto-sauvegardée localement.',
}: NotesPriveesFieldProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [autosaveMin, setAutosaveMin] = useState<number>(() => {
    const stored = localStorage.getItem(INTERVAL_PREF_LS_KEY);
    const parsed = stored ? Number(stored) : NaN;
    return Number.isFinite(parsed) && AUTOSAVE_INTERVALS.some((i) => i.value === parsed)
      ? parsed
      : 10;
  });
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // Persiste la preference d'intervalle
  useEffect(() => {
    localStorage.setItem(INTERVAL_PREF_LS_KEY, String(autosaveMin));
  }, [autosaveMin]);

  // Auto-save vers localStorage selon l'intervalle (0 = désactivé)
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (autosaveMin === 0) return;
    const intervalMs = autosaveMin * 60_000;
    const id = window.setInterval(() => {
      try {
        const ts = Date.now();
        localStorage.setItem(
          storageKey,
          JSON.stringify({ content: valueRef.current, ts }),
        );
        setLastSavedAt(ts);
      } catch {
        /* localStorage plein / désactivé — silencieux */
      }
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [autosaveMin, storageKey]);

  // Refresh du "il y a X" toutes les 30s pour éviter un libellé stale
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Echap pour sortir du plein écran
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const lastSavedLabel = formatLastSaved(lastSavedAt, now);
  const charCount = value.length;

  // Le textarea (réutilisé en inline et en fullscreen avec des styles différents)
  const renderTextarea = (mode: 'inline' | 'fullscreen'): React.ReactElement => (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={mode === 'inline' ? rows : undefined}
      className={cn(
        'input w-full font-mono text-sm leading-relaxed',
        mode === 'inline'
          ? 'min-h-[14rem] resize-y'
          : 'h-full resize-none border-0 rounded-none focus:ring-0',
      )}
      // resize-y => coin bas-droit utilisable; en fullscreen le textarea occupe tout
    />
  );

  return (
    <>
      <div className="space-y-1.5">
        {/* Header : auto-save + indicateur + plein écran */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-2 text-fg-muted">
            <NotebookPen className="w-3.5 h-3.5" />
            <span>
              Auto-sauvegarde locale :
              <select
                value={autosaveMin}
                onChange={(e) => setAutosaveMin(Number(e.target.value))}
                className="ml-1 input input-sm text-xs h-6 py-0 px-1"
                title="Fréquence d'auto-sauvegarde locale"
              >
                {AUTOSAVE_INTERVALS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </span>
            {lastSavedLabel && (
              <span className="text-success">· Sauvegardé {lastSavedLabel}</span>
            )}
            <span className="text-fg-muted font-mono">· {charCount} car.</span>
          </div>
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="inline-flex items-center gap-1 text-primary hover:underline"
            aria-label="Passer en plein écran"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Plein écran
          </button>
        </div>

        {renderTextarea('inline')}
      </div>

      {/* Modal plein écran */}
      {fullscreen && (
        <div className="fixed inset-0 z-[1100] bg-surface flex flex-col">
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-surface2 flex-shrink-0">
            <div className="flex items-center gap-2 text-sm text-fg-2">
              <NotebookPen className="w-4 h-4 text-primary" />
              <span className="font-semibold">Notes privées</span>
              <span className="text-fg-muted text-xs">
                · Échap pour sortir · {charCount} car.
              </span>
              {lastSavedLabel && (
                <span className="text-success text-xs">· Sauvegardé {lastSavedLabel}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="inline-flex items-center gap-1 btn btn-secondary btn-sm"
              aria-label="Quitter le plein écran"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              Réduire
            </button>
          </div>
          <div className="flex-1 overflow-hidden">{renderTextarea('fullscreen')}</div>
        </div>
      )}
    </>
  );
}

/** Format relatif simple ("il y a 2 min", "à l'instant"). */
function formatLastSaved(lastTs: number | null, now: number): string | null {
  if (lastTs === null) return null;
  const deltaSec = Math.max(0, Math.floor((now - lastTs) / 1000));
  if (deltaSec < 30) return 'à l\'instant';
  if (deltaSec < 60) return `il y a ${deltaSec}s`;
  const deltaMin = Math.floor(deltaSec / 60);
  if (deltaMin < 60) return `il y a ${deltaMin} min`;
  const deltaH = Math.floor(deltaMin / 60);
  return `il y a ${deltaH}h${String(deltaMin % 60).padStart(2, '0')}`;
}
