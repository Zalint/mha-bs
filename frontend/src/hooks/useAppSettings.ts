import type { AppSettings } from '@mha-bs/shared';
import { APP_SETTINGS_DEFAULTS } from '@mha-bs/shared';

import { useApi } from './useApi.js';
import { api } from '../lib/apiClient.js';

/**
 * Paramètres applicatifs globaux (GET /settings). Tant que la requête n'a pas
 * abouti — ou si elle échoue — on renvoie les valeurs par défaut partagées, de
 * sorte que les formulaires disposent toujours d'une valeur exploitable sans
 * avoir à gérer un état de chargement.
 */
export function useAppSettings(): AppSettings & { isLoading: boolean } {
  const query = useApi(() => api.get<AppSettings>('/settings'), []);
  return { ...APP_SETTINGS_DEFAULTS, ...(query.data ?? {}), isLoading: query.isLoading };
}
