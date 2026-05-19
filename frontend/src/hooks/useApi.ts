import { useCallback, useEffect, useState } from 'react';

import { ApiClientError } from '../lib/apiClient.js';

interface State<T> {
  data: T | null;
  isLoading: boolean;
  error: ApiClientError | Error | null;
}

/**
 * Hook generique pour fetch declaratif. Refetch automatique :
 *  - quand `deps` change
 *  - au retour de focus sur l'onglet (apres modif dans un autre tab)
 *  - au "back" navigateur (bfcache restore via event pageshow)
 *
 * Usage :
 *   const { data, isLoading, error, refetch } = useApi(() => api.get<Foo>('/foo'), [id]);
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown> = [],
): State<T> & { refetch: () => void } {
  const [state, setState] = useState<State<T>>({ data: null, isLoading: true, error: null });
  const [refreshCount, setRefreshCount] = useState(0);

  const refetch = useCallback(() => setRefreshCount((c) => c + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, isLoading: false, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const error = err instanceof Error ? err : new Error('Erreur inconnue');
        setState({ data: null, isLoading: false, error });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refreshCount]);

  useEffect(() => {
    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') refetch();
    };
    const handlePageShow = (e: PageTransitionEvent): void => {
      if (e.persisted) refetch();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [refetch]);

  return { ...state, refetch };
}
