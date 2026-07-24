import { useCallback, useMemo } from 'react';

import { useApi } from './useApi.js';
import { api } from '../lib/apiClient.js';

export interface Referentiel {
  id: string;
  codeType: string;
  code: string;
  label: string;
  description: string | null;
  parentCode: string | null;
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

  // Index par code : le motif `items.find(t => t.code === code)` etait recopie
  // dans plusieurs vues, chacune avec son propre repli.
  const parCode = useMemo(() => new Map(items.map((i) => [i.code, i])), [items]);

  /** Libelle d'un code ; a defaut le code brut, pour ne jamais afficher vide. */
  const labelDe = useCallback(
    (code: string): string => parCode.get(code)?.label ?? code,
    [parCode],
  );

  /** `parentCode` d'un code (famille de rattachement), `null` si non renseigne. */
  const parentDe = useCallback(
    (code: string): string | null => parCode.get(code)?.parentCode ?? null,
    [parCode],
  );

  return {
    items,
    labelDe,
    parentDe,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
