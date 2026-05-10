import app from './app.js';
import { env } from './config/index.js';
import { logger } from './utils/index.js';
import { startDiscordBot, stopDiscordBot } from './services/index.js';

const server = app.listen(env.PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Server running on http://localhost:${env.PORT}`);
  console.log(`  Waiting for incoming requests...`);
  console.log(`========================================\n`);
});

startDiscordBot();

const shutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);
  stopDiscordBot();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
