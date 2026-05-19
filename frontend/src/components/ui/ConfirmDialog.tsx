import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

import { cn } from '../../lib/cn.js';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void | Promise<void>;
}

/**
 * Modale de confirmation Radix — remplace window.confirm().
 * Aucun alert(), confirm() ou prompt() dans l'application.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'default',
  onConfirm,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async (): Promise<void> => {
    try {
      setLoading(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-fg/40 backdrop-blur-sm z-50 animate-fade-up" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'w-[min(90vw,440px)] bg-surface rounded-lg shadow-lg border border-border',
            'p-6 animate-fade-up',
          )}
        >
          <Dialog.Title className="text-md font-semibold text-fg">{title}</Dialog.Title>
          {description && (
            <Dialog.Description className="mt-2 text-sm text-fg-2 leading-relaxed">
              {description}
            </Dialog.Description>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost" disabled={loading}>
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              type="button"
              className={cn('btn', variant === 'danger' ? 'btn-danger' : 'btn-primary')}
              onClick={() => void handleConfirm()}
              disabled={loading}
            >
              {loading ? 'En cours…' : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
