interface Bar {
  label: string;       // ex. 'Jan 26'
  value: number;
}

interface Props {
  bars: Bar[];
  /** hauteur du graphe en px */
  height?: number;
}

export function MiniHistogram({ bars, height = 48 }: Props) {
  if (bars.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-fg-muted"
        style={{ height }}
      >
        Pas de données
      </div>
    );
  }
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {bars.map((b) => (
          <div key={b.label} className="flex-1 flex flex-col items-stretch" title={`${b.label} : ${b.value}`}>
            <div
              className="bg-primary rounded-t-sm mt-auto"
              style={{ height: `${Math.max((b.value / max) * 100, 3)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-fg-muted mt-1 font-mono">
        {bars.map((b) => (
          <span key={b.label} className="flex-1 text-center">
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
