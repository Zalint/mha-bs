interface Item {
  label: string;
  value: number;
}

interface Props {
  items: Item[];
  /** Affiché si la liste est vide. */
  emptyMessage?: string;
  /** Largeur min du libellé (col CSS), défaut 130px */
  labelWidth?: number;
}

export function BarList({ items, emptyMessage = 'Pas de données', labelWidth = 130 }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-fg-muted py-6 text-center">{emptyMessage}</p>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const widthPct = (item.value / max) * 100;
        return (
          <div
            key={item.label}
            className="grid items-center gap-3"
            style={{ gridTemplateColumns: `${labelWidth}px 1fr 40px` }}
          >
            <div className="text-sm text-fg-2 truncate" title={item.label}>
              {item.label}
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${Math.max(widthPct, 3)}%` }}
              />
            </div>
            <div className="font-mono text-sm font-semibold text-right tabular-nums">
              {item.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
