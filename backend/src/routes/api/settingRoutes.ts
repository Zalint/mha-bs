import { Router } from 'express';

import { updateAppSettingSchema, type UpdateAppSettingInput } from '@mha-bs/shared';

import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import { getAppSettings, setAppSetting } from '../../models/appSettingModel.js';

export const settingRoutes = Router();

// Lecture ouverte à tout utilisateur authentifié : les formulaires en ont
// besoin pour leurs valeurs par défaut.
settingRoutes.get('/', authJwt, async (_req, res, next) => {
  try {
    res.json(await getAppSettings());
  } catch (err) {
    next(err);
  }
});

// Écriture réservée aux admins : un paramètre global change le comportement
// pour tout le monde.
settingRoutes.put(
  '/',
  authJwt,
  requireRole('admin'),
  validate(updateAppSettingSchema),
  async (req, res, next) => {
    try {
      const { key, value } = req.body as UpdateAppSettingInput;
      await setAppSetting(key, value);
      res.json(await getAppSettings());
    } catch (err) {
      next(err);
    }
  },
);
