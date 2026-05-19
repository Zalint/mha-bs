import * as Dialog from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { FormField } from '../ui/FormField.js';
import { PasswordInput } from '../ui/PasswordInput.js';
import { ApiClientError, api } from '../../lib/apiClient.js';
import { cn } from '../../lib/cn.js';

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirm: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeMyPasswordModal({ open, onOpenChange }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();
  const newPwd = watch('newPassword');

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success('Mot de passe mis a jour');
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur');
    }
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-fg/40 backdrop-blur-sm z-50 animate-fade-up" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'w-[min(92vw,460px)] bg-surface rounded-lg shadow-lg border border-border',
            'p-6 animate-fade-up',
          )}
        >
          <Dialog.Title className="text-md font-semibold text-fg">Changer mon mot de passe</Dialog.Title>
          <Dialog.Description className="text-xs text-fg-muted mt-1 mb-4">
            Saisissez votre mot de passe actuel puis le nouveau (8 caracteres minimum).
          </Dialog.Description>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-1">
            <FormField label="Mot de passe actuel" htmlFor="currentPassword" required error={errors.currentPassword?.message}>
              <PasswordInput
                id="currentPassword"
                autoComplete="current-password"
                {...register('currentPassword', { required: 'Champ obligatoire' })}
              />
            </FormField>
            <FormField label="Nouveau mot de passe" htmlFor="newPassword" required error={errors.newPassword?.message}>
              <PasswordInput
                id="newPassword"
                autoComplete="new-password"
                {...register('newPassword', {
                  required: 'Champ obligatoire',
                  minLength: { value: 8, message: 'Min 8 caracteres' },
                })}
              />
            </FormField>
            <FormField label="Confirmation" htmlFor="confirm" required error={errors.confirm?.message}>
              <PasswordInput
                id="confirm"
                autoComplete="new-password"
                {...register('confirm', {
                  required: 'Champ obligatoire',
                  validate: (v) => v === newPwd || 'Les mots de passe ne correspondent pas',
                })}
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-3">
              <Dialog.Close asChild>
                <button type="button" className="btn btn-ghost" disabled={isSubmitting}>
                  Annuler
                </button>
              </Dialog.Close>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Enregistrement...' : 'Changer'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
