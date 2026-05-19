import { Loader2 } from 'lucide-react';

import { cn } from '../../lib/cn.js';

interface Props {
  className?: string;
  label?: string;
}

export function Spinner({ className, label = 'Chargement…' }: Props) {
  return (
    <div className={cn('flex items-center justify-center gap-2 text-fg-muted py-8', className)} role="status">
      <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
      <span className="text-sm">{label}</span>
    </div>
  );
}
