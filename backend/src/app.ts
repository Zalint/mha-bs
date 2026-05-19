import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { appConfig } from './config/index.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { apiRouter } from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resout le dossier du build frontend (en prod : /opt/render/project/src/frontend/dist)
// Depuis backend/dist/app.js : ../../frontend/dist
// Depuis backend/src/app.ts (tsx) : ../../../frontend/dist
const candidatesFrontend = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(__dirname, '../../../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
];
const frontendDist = candidatesFrontend.find((p) => existsSync(p)) ?? null;

export function buildApp(): express.Express {
  const app = express();

  // Securite HTTP — CSP relachee en prod pour autoriser le bundle Vite + Leaflet tiles
  app.use(
    helmet({
      contentSecurityPolicy: false, // SPA sert son propre script ; on garde les autres headers helmet
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Logs HTTP
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/healthz' } }));

  // CORS — uniquement utile en dev quand front et back sont sur des ports differents.
  // En prod avec un seul service, le frontend et l'API partagent la meme origine.
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (appConfig.cors.allowedOrigins.includes(origin)) return callback(null, true);
        // En prod tout vient du meme host → on accepte
        if (appConfig.isProd) return callback(null, true);
        return callback(new Error(`Origine ${origin} non autorisee par CORS`));
      },
      credentials: true,
    }),
  );

  // Parsers
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  // Rate limit global
  app.use(
    rateLimit({
      windowMs: appConfig.rateLimit.windowMs,
      max: appConfig.rateLimit.maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // === API REST ===
  app.use('/api', apiRouter);

  // === Frontend (build Vite servi par Express en prod) ===
  if (frontendDist) {
    logger.info({ frontendDist }, 'Frontend statique servi par Express');
    // 1) Fichiers immutables (assets/, icons/, favicon, etc.) avec cache long
    app.use(
      express.static(frontendDist, {
        index: false,
        maxAge: '7d',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html') || filePath.endsWith('service-worker.js')) {
            res.setHeader('Cache-Control', 'no-store');
          }
        },
      }),
    );
    // 2) SPA catch-all : toute route GET non-API renvoie index.html (React Router prend la suite)
    app.get(/^(?!\/api\/).*/, (_req, res, next) => {
      const indexPath = path.join(frontendDist, 'index.html');
      if (!existsSync(indexPath)) return next();
      res.sendFile(indexPath);
    });
  } else {
    logger.warn(
      "Aucun build frontend trouve : Express ne sert que l'API. Lancez `npm run build:frontend` ou utilisez Vite en dev.",
    );
  }

  // 404 + error handler en dernier (les routes /api/* invalides tombent ici)
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
