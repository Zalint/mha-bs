import type { ReactNode } from 'react';

import { cn } from '../../lib/cn.js';

interface Props {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  help?: string;
  className?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, required, error, help, className, children }: Props) {
  return (
    <div className={cn('mb-3.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="field-label">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
      {help && !error && <p className="field-help">{help}</p>}
    </div>
  );
}
