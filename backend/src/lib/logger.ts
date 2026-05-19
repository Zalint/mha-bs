import { createRequire } from 'node:module';

import pino from 'pino';

import { appConfig } from '../config/index.js';

const require = createRequire(import.meta.url);

function hasModule(name: string): boolean {
  try {
    require.resolve(name);
    return true;
  } catch {
    return false;
  }
}

const usePretty = !appConfig.isProd && hasModule('pino-pretty');

export const logger = pino({
  level: appConfig.logs.level,
  transport: usePretty
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      }
    : undefined,
});
