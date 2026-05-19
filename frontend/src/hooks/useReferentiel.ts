import { useMemo } from 'react';

import { useApi } from './useApi.js';
import { api } from '../lib/apiClient.js';

export interface Referentiel {
  id: string;
  codeType: string;
  code: string;
  label: string;
  description: string | null;
  ordreAffichage: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Hook qui charge les valeurs d'un referentiel par codeType.
 * Les valeurs sont triees par ordreAffichage puis label.
 *
 * Usage :
 *   const { items, isLoading } = useReferentiel('sousSecteur');
 *   const { items: copils } = useReferentiel('copilProjet');
 */
export function useReferentiel(codeType: string) {
  const query = useApi(
    () => api.get<{ items: Referentiel[] }>('/referentiels', { query: { codeType } }),
    [codeType],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  return {
    items,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
