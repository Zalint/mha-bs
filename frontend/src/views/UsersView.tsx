import * as Dialog from '@radix-ui/react-dialog';
import { KeyRound, Pencil, Plus, ShieldCheck, UserX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { USER_ROLES, type UserRole } from '@mha-bs/shared';

import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { FormField } from '../components/ui/FormField.js';
import { Spinner } from '../components/ui/Spinner.js';
import { useApi } from '../hooks/useApi.js';
import { ApiClientError, api } from '../lib/apiClient.js';
import { cn } from '../lib/cn.js';
import { formatShort } from '../lib/formatDate.js';
import { useAuthStore } from '../stores/authStore.js';

interface AppUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  sg: 'Secrétaire général',
  bs: 'Bureau de Suivi',
  reader: 'Lecteur',
};

const ROLE_STYLES: Record<UserRole, string> = {
  admin: 'bg-danger-bg text-danger',
  sg: 'bg-success-bg text-success',
  bs: 'bg-primary-100 text-primary-700',
  reader: 'bg-muted text-fg-2',
};

export function UsersView() {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AppUser | null>(null);
  const [pwdTarget, setPwdTarget] = useState<AppUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<AppUser | null>(null);

  const query = useApi(() => api.get<{ items: AppUser[] }>('/users'), []);
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const handleDeactivate = async (): Promise<void> => {
    if (!deactivateTarget) return;
    try {
      await api.post(`/users/${deactivateTarget.id}/deactivate`);
      toast.success(`${deactivateTarget.username} desactive`);
      query.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur');
    }
  };

  const handleActivate = async (u: AppUser): Promise<void> => {
    try {
      await api.post(`/users/${u.id}/activate`);
      toast.success(`${u.username} reactive`);
      query.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-danger-bg text-danger rounded text-[11.5px] font-semibold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5" /> Administration
          </div>
          <h1 className="text-2xl font-semibold text-fg leading-tight">Utilisateurs</h1>
          <p className="text-sm text-fg-muted mt-1">
            Creez et gerez les comptes des collaborateurs : role, mot de passe, activation.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus className="w-3.5 h-3.5" />
          Nouvel utilisateur
        </button>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="bg-surface2 px-4 py-3 border-b border-border flex items-center">
          <h2 className="text-md font-semibold">Comptes</h2>
          <span className="ml-2 text-sm text-fg-muted font-mono">{items.length}</span>
        </div>
        {query.isLoading ? (
          <Spinner label="Chargement..." />
        ) : items.length === 0 ? (
          <div className="text-center text-fg-muted py-10 text-sm">Aucun utilisateur.</div>
        ) : (
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="bg-surface2">
              <tr>
                <Th>Username</Th>
                <Th>Nom complet</Th>
                <Th>Email</Th>
                <Th className="w-44">Role</Th>
                <Th className="w-24 text-center">Actif</Th>
                <Th className="w-32">Dernier login</Th>
                <Th className="w-32 text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className={cn('border-b border-border last:border-0 hover:bg-muted', !u.isActive && 'opacity-60')}>
                  <td className="px-4 py-2.5 font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-2.5">{u.fullName}</td>
                  <td className="px-4 py-2.5 text-fg-2">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('badge', ROLE_STYLES[u.role])}>{ROLE_LABELS[u.role]}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {u.isActive ? (
                      <span className="badge bg-success-bg text-success">Actif</span>
                    ) : (
                      <span className="badge bg-muted text-fg-muted">Inactif</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted font-mono text-xs">
                    {u.lastLoginAt ? formatShort(u.lastLoginAt.slice(0, 10)) : '—'}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <div className="inline-flex gap-1">
                      <IconBtn title="Modifier" onClick={() => setEditTarget(u)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </IconBtn>
                      <IconBtn title="Reinitialiser mot de passe" onClick={() => setPwdTarget(u)}>
                        <KeyRound className="w-3.5 h-3.5" />
                      </IconBtn>
                      {u.id !== currentUserId && (
                        u.isActive ? (
                          <IconBtn title="Desactiver" danger onClick={() => setDeactivateTarget(u)}>
                            <UserX className="w-3.5 h-3.5" />
                          </IconBtn>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-ghost text-xs px-2 py-1"
                            onClick={() => void handleActivate(u)}
                          >
                            Reactiver
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateUserModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => query.refetch()}
      />
      {editTarget && (
        <EditUserModal
          user={editTarget}
          onOpenChange={(o) => !o && setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            query.refetch();
          }}
        />
      )}
      {pwdTarget && (
        <ResetPasswordModal
          user={pwdTarget}
          onOpenChange={(o) => !o && setPwdTarget(null)}
          onDone={() => setPwdTarget(null)}
        />
      )}
      <ConfirmDialog
        open={deactivateTarget !== null}
        onOpenChange={(o) => !o && setDeactivateTarget(null)}
        title={`Desactiver ${deactivateTarget?.username} ?`}
        description="L'utilisateur ne pourra plus se connecter. Vous pourrez le reactiver plus tard."
        confirmLabel="Desactiver"
        variant="danger"
        onConfirm={() => handleDeactivate()}
      />
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'text-left px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border font-semibold',
        className,
      )}
    >
      {children}
    </th>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'p-1.5 rounded hover:bg-muted',
        danger ? 'text-fg-muted hover:text-danger' : 'text-fg-muted hover:text-primary',
      )}
    >
      {children}
    </button>
  );
}

interface CreateFormValues {
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  password: string;
}

function CreateUserModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateFormValues>({
    defaultValues: { role: 'reader' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post('/users', values);
      toast.success('Utilisateur cree');
      reset({ role: 'reader' });
      onOpenChange(false);
      onCreated();
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
            'w-[min(92vw,520px)] bg-surface rounded-lg shadow-lg border border-border',
            'p-6 animate-fade-up',
          )}
        >
          <Dialog.Title className="text-md font-semibold text-fg mb-4">Nouvel utilisateur</Dialog.Title>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-1">
            <FormField label="Username" htmlFor="username" required error={errors.username?.message}>
              <input
                id="username"
                className="input font-mono"
                placeholder="ex. jdupont"
                {...register('username', {
                  required: 'Champ obligatoire',
                  minLength: { value: 3, message: 'Min 3 caracteres' },
                  pattern: { value: /^[a-z0-9._-]+$/i, message: 'Alphanumerique uniquement' },
                })}
              />
            </FormField>
            <FormField label="Nom complet" htmlFor="fullName" required error={errors.fullName?.message}>
              <input
                id="fullName"
                className="input"
                placeholder="Jean Dupont"
                {...register('fullName', { required: 'Champ obligatoire', minLength: { value: 2, message: 'Min 2 caracteres' } })}
              />
            </FormField>
            <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="jean.dupont@mha.sn"
                {...register('email', {
                  required: 'Champ obligatoire',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email invalide' },
                })}
              />
            </FormField>
            <FormField label="Role" htmlFor="role" required error={errors.role?.message}>
              <select id="role" className="select" {...register('role', { required: true })}>
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Mot de passe initial" htmlFor="password" required error={errors.password?.message}>
              <input
                id="password"
                type="text"
                className="input font-mono"
                placeholder="8 caracteres minimum"
                {...register('password', {
                  required: 'Champ obligatoire',
                  minLength: { value: 8, message: 'Min 8 caracteres' },
                })}
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-3">
              <Dialog.Close asChild>
                <button type="button" className="btn btn-ghost">
                  Annuler
                </button>
              </Dialog.Close>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creation...' : 'Creer'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface EditFormValues {
  email: string;
  fullName: string;
  role: UserRole;
}

function EditUserModal({
  user,
  onOpenChange,
  onSaved,
}: {
  user: AppUser;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditFormValues>({
    defaultValues: { email: user.email, fullName: user.fullName, role: user.role },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.put(`/users/${user.id}`, values);
      toast.success('Utilisateur mis a jour');
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur');
    }
  });

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-fg/40 backdrop-blur-sm z-50 animate-fade-up" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'w-[min(92vw,520px)] bg-surface rounded-lg shadow-lg border border-border',
            'p-6 animate-fade-up',
          )}
        >
          <Dialog.Title className="text-md font-semibold text-fg">Modifier {user.username}</Dialog.Title>
          <Dialog.Description className="text-xs text-fg-muted mt-1 mb-4">
            Le username n'est pas modifiable. Pour le mot de passe, utilisez le bouton dedie.
          </Dialog.Description>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-1">
            <FormField label="Nom complet" htmlFor="fullName" required error={errors.fullName?.message}>
              <input
                id="fullName"
                className="input"
                {...register('fullName', { required: 'Champ obligatoire', minLength: { value: 2, message: 'Min 2 caracteres' } })}
              />
            </FormField>
            <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
              <input
                id="email"
                type="email"
                className="input"
                {...register('email', {
                  required: 'Champ obligatoire',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email invalide' },
                })}
              />
            </FormField>
            <FormField label="Role" htmlFor="role" required>
              <select id="role" className="select" {...register('role', { required: true })}>
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="flex justify-end gap-2 pt-3">
              <Dialog.Close asChild>
                <button type="button" className="btn btn-ghost">
                  Annuler
                </button>
              </Dialog.Close>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface ResetPasswordValues {
  password: string;
  confirm: string;
}

function ResetPasswordModal({
  user,
  onOpenChange,
  onDone,
}: {
  user: AppUser;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>();
  const pwd = watch('password');

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post(`/users/${user.id}/reset-password`, { password: values.password });
      toast.success(`Mot de passe de ${user.username} mis a jour`);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur');
    }
  });

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-fg/40 backdrop-blur-sm z-50 animate-fade-up" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'w-[min(92vw,460px)] bg-surface rounded-lg shadow-lg border border-border',
            'p-6 animate-fade-up',
          )}
        >
          <Dialog.Title className="text-md font-semibold text-fg">Reinitialiser le mot de passe</Dialog.Title>
          <Dialog.Description className="text-xs text-fg-muted mt-1 mb-4">
            Nouveau mot de passe pour <strong className="font-mono">{user.username}</strong>. Communiquez-le a l'utilisateur de maniere securisee.
          </Dialog.Description>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-1">
            <FormField label="Nouveau mot de passe" htmlFor="password" required error={errors.password?.message}>
              <input
                id="password"
                type="text"
                className="input font-mono"
                placeholder="8 caracteres minimum"
                {...register('password', {
                  required: 'Champ obligatoire',
                  minLength: { value: 8, message: 'Min 8 caracteres' },
                })}
              />
            </FormField>
            <FormField label="Confirmation" htmlFor="confirm" required error={errors.confirm?.message}>
              <input
                id="confirm"
                type="text"
                className="input font-mono"
                {...register('confirm', {
                  required: 'Champ obligatoire',
                  validate: (v) => v === pwd || 'Les mots de passe ne correspondent pas',
                })}
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-3">
              <Dialog.Close asChild>
                <button type="button" className="btn btn-ghost">
                  Annuler
                </button>
              </Dialog.Close>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Enregistrement...' : 'Reinitialiser'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
