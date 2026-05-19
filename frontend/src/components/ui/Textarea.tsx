import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '../../lib/cn.js';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ className, invalid, rows = 4, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full px-3 py-2 border rounded text-sm font-sans bg-surface text-fg resize-y',
        'focus:outline-none focus:ring-2 focus:ring-primary/20',
        invalid ? 'border-danger focus:border-danger' : 'border-border focus:border-primary',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
