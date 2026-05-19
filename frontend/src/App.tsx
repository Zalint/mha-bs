import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';

import { Toaster } from './components/ui/Toaster.js';
import { configureApiClient } from './lib/apiClient.js';
import { router } from './router/index.js';
import { useAuthStore } from './stores/authStore.js';

export function App() {
  useEffect(() => {
    // Branchement de l'apiClient sur le store auth
    configureApiClient({
      getTokens: () => {
        const state = useAuthStore.getState();
        return { accessToken: state.accessToken, refreshToken: state.refreshToken };
      },
      setTokens: (accessToken, refreshToken) => {
        useAuthStore.getState().setTokens(accessToken, refreshToken);
      },
      onUnauthorized: () => {
        useAuthStore.getState().logout();
      },
    });

    // Rafraichit le profil utilisateur si on a un token persiste
    void useAuthStore.getState().loadMe();
  }, []);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
