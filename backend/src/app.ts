import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { appConfig } from './config/index.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { apiRouter } from './routes/index.js';

export function buildApp(): express.Express {
  const app = express();

  // Sécurité HTTP
  app.use(
    helmet({
      contentSecurityPolicy: appConfig.isProd ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Logs HTTP
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/healthz' } }));

  // CORS
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (appConfig.cors.allowedOrigins.includes(origin)) return callback(null, true);
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

  // Routes
  app.use('/api', apiRouter);

  // 404 + error handler en dernier
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
