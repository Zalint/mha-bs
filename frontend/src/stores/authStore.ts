import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { LoginInput, User } from '@mha-bs/shared';

import { api } from '../lib/apiClient.js';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  loadMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isLoading: false,

      async login(input) {
        set({ isLoading: true });
        try {
          const result = await api.post<{ accessToken: string; refreshToken: string; user: User }>(
            '/auth/login',
            input,
            { skipAuth: true },
          );
          set({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            user: result.user,
            isLoading: false,
          });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout() {
        set({ accessToken: null, refreshToken: null, user: null });
      },

      setTokens(accessToken, refreshToken) {
        set({ accessToken, refreshToken });
      },

      async loadMe() {
        const { accessToken } = get();
        if (!accessToken) return;
        try {
          const user = await api.get<User>('/auth/me');
          set({ user });
        } catch {
          // 401 sera géré par l'apiClient → logout
        }
      },
    }),
    {
      name: 'mha-bs-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);
