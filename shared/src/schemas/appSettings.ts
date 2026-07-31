import { z } from 'zod';

/**
 * Paramètres applicatifs — réglages globaux booléens, modifiables via
 * /bs/config (section Paramètres). Distincts des référentiels (qui sont des
 * listes). Chaque clé a une valeur par défaut ici : si la table `appSettings`
 * ne la contient pas encore, c'est cette valeur qui s'applique.
 */
export const appSettingsSchema = z.object({
  /**
   * Réunions visibles au SG par défaut : la case « Visible au SG » du formulaire
   * de réunion démarre cochée. N'AUTOPUBLIE PAS à l'étape 1 — la réunion se
   * publie en enregistrant l'étape 2 avec la case cochée.
   */
  reunionVisibleSgParDefaut: z.boolean(),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

/** Valeurs par défaut appliquées quand la clé est absente de la base. */
export const APP_SETTINGS_DEFAULTS: AppSettings = {
  reunionVisibleSgParDefaut: true,
};

/** Métadonnées d'affichage pour la section Paramètres de Config. */
export const APP_SETTINGS_META: ReadonlyArray<{
  key: keyof AppSettings;
  label: string;
  description: string;
}> = [
  {
    key: 'reunionVisibleSgParDefaut',
    label: 'Réunions visibles au SG par défaut',
    description:
      "La case « Visible au SG » démarre cochée à la création d'une réunion. La réunion reste publiée uniquement une fois l'étape 2 enregistrée.",
  },
];

/** Corps accepté par la mise à jour d'un paramètre. */
export const updateAppSettingSchema = z.object({
  key: z.enum(
    Object.keys(APP_SETTINGS_DEFAULTS) as [keyof AppSettings, ...(keyof AppSettings)[]],
  ),
  value: z.boolean(),
});
export type UpdateAppSettingInput = z.infer<typeof updateAppSettingSchema>;
