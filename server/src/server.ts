import { createApp } from './app.js';
import { env } from './config/env.js';
import { log } from './lib/logger.js';
import { disconnectPrisma } from './lib/prisma.js';

const app = createApp();
const server = app.listen(env.PORT, () => {
  log.sys.info(`listening on port ${env.PORT}`, { env: env.NODE_ENV });
});

async function shutdown(signal: string) {
  log.sys.info(`${signal} received, shutting down`);
  server.close(() => void 0);
  await disconnectPrisma();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
