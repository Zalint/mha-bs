import { cn } from '../../lib/cn.js';

export interface BarItem {
  label: string;
  value: number;
  /** Couleur principale de la barre (CSS color). */
  color: string;
  /** Couleur dégradé clair (top). Si absent, utilise `color`. */
  colorLight?: string;
}

interface VerticalBarChartProps {
  bars: BarItem[];
  /** Hauteur du stage en pixels (zone où les barres grandissent). Défaut 160. */
  stageHeight?: number;
  /** Hauteur max d'une barre en pixels. Défaut = stageHeight - 30 (laisse de la place pour la valeur au-dessus). */
  maxBarHeight?: number;
  /** Bandeau coloré en haut du chart (CSS background, ex: linear-gradient). */
  accentGradient?: string;
  /** Titre optionnel affiché au-dessus du stage. */
  title?: string;
  /** Action optionnelle à droite du titre (ex: toggle). */
  titleAction?: React.ReactNode;
  className?: string;
}

/**
 * Histogramme vertical : barres colorées avec valeur au-dessus et label en
 * dessous, le tout dans un cadre stylé (bandeau dégradé + ligne de base).
 *
 * Les hauteurs sont calculées en pixels (proportionnelles à `value / maxValue`)
 * pour rester fiables même quand certaines valeurs sont très faibles.
 */
export function VerticalBarChart({
  bars,
  stageHeight = 160,
  maxBarHeight,
  accentGradient,
  title,
  titleAction,
  className,
}: VerticalBarChartProps) {
  const maxValue = Math.max(...bars.map((b) => b.value), 1);
  const barMax = maxBarHeight ?? Math.max(stageHeight - 30, 60);

  return (
    <div
      className={cn(
        'relative bg-gradient-to-b from-white to-surface2 border border-border rounded-lg p-4 pt-5',
        className,
      )}
    >
      {accentGradient && (
        <div
          className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg"
          style={{ background: accentGradient }}
        />
      )}
      {title && (
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fg-muted flex items-center gap-2">
            {accentGradient && (
              <span
                className="w-4 h-4 rounded"
                style={{ background: accentGradient }}
              />
            )}
            {title}
          </div>
          {titleAction}
        </div>
      )}

      {/* Stage des barres */}
      <div
        className="flex items-end justify-around gap-3"
        style={{ height: stageHeight }}
      >
        {bars.map((b, i) => {
          const heightPx = Math.max((b.value / maxValue) * barMax, 3);
          const bg = b.colorLight
            ? `linear-gradient(180deg, ${b.colorLight} 0%, ${b.color} 100%)`
            : b.color;
          return (
            <div
              key={`${b.label}-${i}`}
              className="flex-1 flex flex-col items-center justify-end h-full max-w-[90px]"
            >
              <div className="font-mono text-sm font-bold text-fg-2 mb-1">{b.value}</div>
              <div
                className="w-full rounded-t transition-[height,background-color] duration-300"
                style={{
                  height: `${heightPx}px`,
                  background: bg,
                  boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.08)',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Labels en dessous, séparés par une ligne */}
      <div className="flex justify-around gap-3 mt-2 pt-2 border-t border-border">
        {bars.map((b, i) => (
          <div
            key={`label-${b.label}-${i}`}
            className="flex-1 max-w-[90px] text-center text-xs font-semibold"
            style={{ color: b.color }}
          >
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}
