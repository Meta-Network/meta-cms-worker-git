import cron from 'cron';
import timer from 'timers';

import { logger } from './logger';
import { startGitTask } from './task';

async function bootstrap(): Promise<void> {
  logger.info('App started');

  timer
    .setTimeout(async () => {
      await startGitTask();
    }, 3000)
    .unref();

  const healthCheck = new cron.CronJob('*/10 * * * * *', async () => {
    logger.info('Health check');
  });

  healthCheck.start();
}

bootstrap();
