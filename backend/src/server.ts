import { buildApp } from './app.js';
import { appConfig } from './config/index.js';
import { closePool, pingDb } from './db/pool.js';
import { logger } from './lib/logger.js';

async function start(): Promise<void> {
  try {
    await pingDb();
    logger.info('Connexion PostgreSQL OK');
  } catch (err) {
    logger.fatal({ err }, 'Impossible de joindre PostgreSQL au demarrage');
    process.exit(1);
  }

  const app = buildApp();
  const server = app.listen(appConfig.port, () => {
    logger.info(
      `Serveur MHA Bureau de Suivi demarre · port ${appConfig.port} · env ${appConfig.env}`,
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} recu, arret gracieux en cours...`);
    server.close(async () => {
      await closePool();
      logger.info('Arret termine');
      process.exit(0);
    });
    // Force kill apres 10 sec
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void start();
