import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { loginSchema, type LoginInput } from '@mha-bs/shared';

import { PasswordInput } from '../components/ui/PasswordInput.js';
import { ApiClientError } from '../lib/apiClient.js';
import { useAuthStore } from '../stores/authStore.js';

export function LoginView() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const onSubmit = async (data: LoginInput): Promise<void> => {
    try {
      await login(data);
      const from = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(from, { replace: true });
      toast.success('Connexion reussie');
    } catch (err) {
      if (err instanceof ApiClientError) {
        toast.error(err.message);
      } else {
        toast.error('Erreur de connexion');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-primary-100 to-primary-50 p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src="/logo.png" alt="Focus MHA" className="w-16 h-16 rounded-xl object-contain bg-white shadow-sm" />
          <div>
            <h1 className="text-lg font-bold text-fg">MHA · Bureau de Suivi</h1>
            <p className="text-xs text-fg-muted">Ministère de l'Hydraulique et de l'Assainissement</p>
          </div>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="bg-surface border border-border rounded-lg shadow-lg p-8"
        >
          <h2 className="text-lg font-semibold text-fg mb-6">Connexion</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="field-label">
                Nom d'utilisateur
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                {...register('username')}
                className="input"
                placeholder="ex. saliou.d"
              />
              {errors.username && (
                <p className="text-xs text-danger mt-1">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="field-label">
                Mot de passe
              </label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-danger mt-1">{errors.password.message}</p>
              )}
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-full mt-6 justify-center" disabled={isLoading}>
            <LogIn className="w-4 h-4" />
            {isLoading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-xs text-fg-muted mt-6">
          Bureau de Suivi du MHA · République du Sénégal
        </p>
      </div>
    </div>
  );
}
