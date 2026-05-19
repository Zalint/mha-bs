import { Router } from 'express';

import { appConfig } from '../config/index.js';
import { authApiKey } from '../middlewares/authApiKey.js';

import { authRoutes } from './api/authRoutes.js';
import { dashboardRoutes } from './api/dashboardRoutes.js';
import { directionRoutes } from './api/directionRoutes.js';
import { directiveRoutes } from './api/directiveRoutes.js';
import { healthRoutes } from './api/healthRoutes.js';
import { matriceRoutes } from './api/matriceRoutes.js';
import { missionRoutes } from './api/missionRoutes.js';
import { referentielRoutes } from './api/referentielRoutes.js';
import { rencontreRoutes } from './api/rencontreRoutes.js';
import { reunionRoutes } from './api/reunionRoutes.js';
import { userRoutes } from './api/userRoutes.js';
import { externalDirectiveRoutes } from './external/directiveRoutes.js';
import { externalHealthRoutes } from './external/healthRoutes.js';

export const apiRouter = Router();

// --- API interne (JWT) ---
apiRouter.use('/', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/directions', directionRoutes);
apiRouter.use('/rencontres', rencontreRoutes);
apiRouter.use('/directives', directiveRoutes);
apiRouter.use('/matrices', matriceRoutes);
apiRouter.use('/reunions', reunionRoutes);
apiRouter.use('/missions', missionRoutes);
apiRouter.use('/referentiels', referentielRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/users', userRoutes);

// --- API externe (x-api-key) ---
if (appConfig.externalApi.enabled) {
  apiRouter.use('/external', authApiKey, externalHealthRoutes);
  apiRouter.use('/external/directives', authApiKey, externalDirectiveRoutes);
}
