import app from './app.js';
import { config, initSecrets } from './config/index.js';
import { logger } from './utils/logger.js';

const PORT = config.port;

async function startServer() {
  // Initialize secrets from configured source (env, aws, or vault)
  await initSecrets();

  app.listen(PORT, () => {
    logger.info('ERP & POS Backend API started', { port: PORT, environment: config.nodeEnv });
  });
}

startServer().catch((error) => {
  logger.error('Failed to start server', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});
