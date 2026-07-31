import type { AppSettings } from '@mha-bs/shared';
import { APP_SETTINGS_DEFAULTS } from '@mha-bs/shared';

import { query, queryAll } from '../db/query.js';

/**
 * Lit tous les paramètres applicatifs, en superposant les valeurs stockées en
 * base sur les valeurs par défaut. Une clé absente de la table garde donc son
 * défaut — l'appli fonctionne même si le seed n'a pas tourné.
 */
export async function getAppSettings(): Promise<AppSettings> {
  const rows = await queryAll<{ key: string; value: string }>(
    `SELECT "key", "value" FROM "appSettings"`,
  );
  const settings: AppSettings = { ...APP_SETTINGS_DEFAULTS };
  for (const row of rows) {
    if (row.key in settings) {
      // Valeur stockée en texte 'true'/'false'.
      (settings as Record<string, boolean>)[row.key] = row.value === 'true';
    }
  }
  return settings;
}

/**
 * Écrit un paramètre (UPSERT). La clé est validée en amont par le schéma Zod
 * partagé (`updateAppSettingSchema`), donc bornée aux clés connues.
 */
export async function setAppSetting(key: keyof AppSettings, value: boolean): Promise<void> {
  await query(
    `INSERT INTO "appSettings" ("key", "value", "updatedAt")
     VALUES ($1, $2, NOW())
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW()`,
    [key, value ? 'true' : 'false'],
  );
}
